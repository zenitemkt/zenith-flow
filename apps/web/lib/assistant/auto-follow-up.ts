import { Prisma, prisma } from "@zenite-mkt/db";
import { raiseSystemAlert } from "@/lib/system-alerts";
import { loadAssistant } from "./agent";
import { AUTO_FOLLOW_UP_STAGES, CLOSED_LEAD_STATUSES, autoFollowUpMessage, dueFollowUpStage } from "./follow-up";
import { sendTemplate, sendText } from "./whatsapp";

/**
 * Retomada automática de lead que recebeu mensagem nossa (Milena ou equipe) e não respondeu:
 * 23h (mensagem livre, ainda dentro da janela de 24h da Meta), 3 dias e 7 dias (modelo aprovado
 * `ASSISTANT_FOLLOWUP_TEMPLATE`, janela fechada havia muito). A mensagem de "[sistema] ..." e as
 * próprias retomadas ("[retomada] ...") não contam como a "última mensagem real" — senão cada
 * retomada reiniciaria a contagem de silêncio e os estágios de 3/7 dias nunca chegariam a tempo.
 */
interface FollowUpCandidate {
  conversationId: string;
  agencyId: string;
  phone: string;
  profileName: string | null;
  leadId: string | null;
  followUpStage: number;
  lastRealMessageAt: Date;
}

async function findFollowUpCandidates(): Promise<FollowUpCandidate[]> {
  const rows = await prisma.$queryRaw<{ conversationId: string; agencyId: string; phone: string; profileName: string | null; leadId: string | null; followUpStage: number; lastRealMessageAt: Date }[]>(
    Prisma.sql`
      SELECT c."id" AS "conversationId", c."agencyId", c."phone", c."profileName", c."leadId", c."followUpStage", m."createdAt" AS "lastRealMessageAt"
      FROM "assistant_conversation" c
      JOIN LATERAL (
        SELECT "createdAt", "role" FROM "assistant_message"
        WHERE "conversationId" = c."id" AND "content" NOT LIKE '[sistema]%' AND "content" NOT LIKE '[retomada]%'
        ORDER BY "createdAt" DESC LIMIT 1
      ) m ON true
      WHERE c."mode" = 'bot' AND c."followUpStage" < 3 AND c."followUpOptOut" = false AND m."role" != 'user'
        AND m."createdAt" < NOW() - INTERVAL '22 hours'
    `,
  );
  return rows;
}

async function leadStatusesOf(candidates: FollowUpCandidate[]): Promise<Map<string, string>> {
  const leadIds = candidates.map((c) => c.leadId).filter((id): id is string => Boolean(id));
  if (leadIds.length === 0) return new Map();
  const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, status: true } });
  return new Map(leads.map((lead) => [lead.id, lead.status]));
}

/** Rodada do agendador: manda a retomada que estiver vencida pra cada conversa parada. */
export async function runAutoFollowUps(now = new Date()): Promise<{ sent: number }> {
  const candidates = await findFollowUpCandidates();
  if (candidates.length === 0) return { sent: 0 };
  const statuses = await leadStatusesOf(candidates);
  const configs = new Map<string, Awaited<ReturnType<typeof loadAssistant>>>();
  let sent = 0;

  for (const candidate of candidates) {
    if (candidate.leadId && CLOSED_LEAD_STATUSES.has(statuses.get(candidate.leadId) ?? "")) continue;
    if (!configs.has(candidate.agencyId)) configs.set(candidate.agencyId, await loadAssistant(candidate.agencyId));
    const { enabled, config } = configs.get(candidate.agencyId)!;
    if (!enabled || !config.followUp.autoEnabled) continue;

    const silentHours = (now.getTime() - candidate.lastRealMessageAt.getTime()) / 3_600_000;
    const due = dueFollowUpStage(silentHours, candidate.followUpStage);
    if (!due) continue;

    const text = autoFollowUpMessage(candidate.profileName, due.stage);
    try {
      if (due.kind === "text") {
        await sendText(candidate.phone, text);
      } else {
        const template = process.env.ASSISTANT_FOLLOWUP_TEMPLATE;
        if (!template) {
          await raiseSystemAlert({
            agencyId: candidate.agencyId,
            key: "assistant:followup-template",
            category: "AUTOMATION",
            severity: "WARNING",
            title: "WhatsApp: retomada automática de lead sem modelo aprovado",
            detail: "Configure ASSISTANT_FOLLOWUP_TEMPLATE (modelo aprovado pra retomar lead depois de 3 ou 7 dias de silêncio).",
            href: "/automacoes/assistente",
          }).catch(() => null);
          continue;
        }
        await sendTemplate(candidate.phone, template, [text]);
      }
      await prisma.assistantConversation.update({ where: { id: candidate.conversationId }, data: { followUpStage: due.stage } });
      await prisma.assistantMessage.create({ data: { conversationId: candidate.conversationId, role: "assistant", content: `[retomada] ${text}` } });
      sent++;
    } catch (error) {
      console.error("assistant_auto_followup_failed", candidate.conversationId, error);
    }
  }
  return { sent };
}

/** Próximos horários em que alguma retomada automática vence — pro cron-wake saber quando acordar. */
export async function nextAutoFollowUpWakeTimes(now = new Date()): Promise<Date[]> {
  const candidates = await findFollowUpCandidates();
  const out: Date[] = [];
  for (const candidate of candidates) {
    const next = AUTO_FOLLOW_UP_STAGES.find((def) => def.stage > candidate.followUpStage);
    if (next) out.push(new Date(candidate.lastRealMessageAt.getTime() + next.afterHours * 3_600_000));
  }
  return out;
}
