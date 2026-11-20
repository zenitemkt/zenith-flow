import { Prisma, prisma } from "@zenite-mkt/db";
import { raiseSystemAlert } from "@/lib/system-alerts";
import { loadAssistant } from "./agent";
import { firstName } from "./form-outreach";
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
  prospectId: string | null;
  lastInboundAt: Date | null;
  followUpStage: number;
  lastRealMessageAt: Date;
}

const WINDOW_MS = 24 * 3_600_000;

async function findFollowUpCandidates(): Promise<FollowUpCandidate[]> {
  const rows = await prisma.$queryRaw<FollowUpCandidate[]>(
    Prisma.sql`
      SELECT c."id" AS "conversationId", c."agencyId", c."phone", c."profileName", c."leadId", c."prospectId", c."lastInboundAt", c."followUpStage", m."createdAt" AS "lastRealMessageAt"
      FROM "assistant_conversation" c
      JOIN LATERAL (
        SELECT "createdAt", "role" FROM "assistant_message"
        WHERE "conversationId" = c."id" AND "content" NOT LIKE '[sistema]%' AND "content" NOT LIKE '[retomada]%'
        ORDER BY "createdAt" DESC LIMIT 1
      ) m ON true
      WHERE c."mode" = 'bot' AND c."followUpStage" < 3 AND c."followUpOptOut" = false AND m."role" != 'user'
        AND m."createdAt" < NOW() - INTERVAL '22 hours'
        -- Prospecção que ainda não respondeu: o follow-up é manual, na rotina da manhã (tela de Prospecção).
        AND (c."prospectId" IS NULL OR c."leadId" IS NOT NULL)
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
    const nextStage = due.stage;

    // Texto livre só vale com a janela de 24h aberta (a pessoa escreveu nas últimas 24h); fechada, pula o toque.
    const windowOpen = candidate.lastInboundAt !== null && now.getTime() - new Date(candidate.lastInboundAt).getTime() < WINDOW_MS;
    if (due.kind === "text" && !windowOpen) {
      await prisma.assistantConversation.update({ where: { id: candidate.conversationId }, data: { followUpStage: nextStage } });
      continue;
    }

    const greetName = candidate.profileName;
    const text = autoFollowUpMessage(greetName, due.stage);
    try {
      if (due.kind === "text") {
        await sendText(candidate.phone, text);
      } else {
        const template = due.templateEnvVar ? process.env[due.templateEnvVar] : undefined;
        if (!template) {
          await raiseSystemAlert({
            agencyId: candidate.agencyId,
            key: `assistant:followup-template:${due.stage}`,
            category: "AUTOMATION",
            severity: "WARNING",
            title: `WhatsApp: retomada automática de ${due.afterHours}h sem modelo aprovado`,
            detail: `Configure ${due.templateEnvVar} (modelo aprovado desse estágio da retomada). Esse toque foi pulado.`,
            href: "/automacoes/assistente",
          }).catch(() => null);
          // Pula o toque em vez de tentar de novo a cada minuto (manteria o banco acordado à toa).
          await prisma.assistantConversation.update({ where: { id: candidate.conversationId }, data: { followUpStage: nextStage } });
          continue;
        }
        const name = firstName(greetName) || "pessoal";
        await sendTemplate(candidate.phone, template, [name]);
      }
      await prisma.assistantConversation.update({ where: { id: candidate.conversationId }, data: { followUpStage: nextStage } });
      await prisma.assistantMessage.create({ data: { conversationId: candidate.conversationId, role: "assistant", content: `[retomada] ${text}` } });
      sent++;
    } catch (error) {
      console.error("assistant_auto_followup_failed", candidate.conversationId, error);
      // Falhou (número inválido, modelo recusado...): não tenta de novo a cada minuto.
      await prisma.assistantConversation.update({ where: { id: candidate.conversationId }, data: { followUpStage: nextStage } }).catch(() => null);
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
    if (next) out.push(new Date(new Date(candidate.lastRealMessageAt).getTime() + next.afterHours * 3_600_000));
  }
  return out;
}
