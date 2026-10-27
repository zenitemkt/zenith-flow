import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { mergeAssistantConfig } from "@/lib/assistant/config";
import { listCalendars } from "@/lib/assistant/calendar";
import { AssistantSettingsForm } from "./AssistantSettingsForm";
import { HumanConversations } from "./HumanConversations";

const CONNECTIONS: [string, string[]][] = [
  ["WhatsApp (coexistência)", ["ASSISTANT_WA_TOKEN", "ASSISTANT_WA_PHONE_NUMBER_ID", "ASSISTANT_WA_APP_SECRET", "ASSISTANT_WA_VERIFY_TOKEN"]],
  ["Claude (respostas)", ["ANTHROPIC_API_KEY"]],
  ["OpenAI (transcrição de áudio)", ["OPENAI_API_KEY"]],
  ["Agendador de 1 minuto", ["ASSISTANT_CRON_SECRET"]],
];

export default async function AssistantPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  const [settings, humanConversations, bookings] = await Promise.all([
    prisma.assistantSettings.findUnique({ where: { agencyId: membership.agencyId } }),
    prisma.assistantConversation.findMany({ where: { agencyId: membership.agencyId, mode: "human" }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.assistantBooking.findMany({
      where: { agencyId: membership.agencyId, status: { not: "cancelled" }, startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 10,
      include: { conversation: { select: { profileName: true, phone: true } } },
    }),
  ]);
  const config = mergeAssistantConfig(settings?.config);
  const calendars = settings?.googleRefreshTokenEnc ? await listCalendars().catch(() => []) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#101828]">Assistente virtual</h1>
        <p className="mt-1 text-sm text-[#667085]">Painel da {config.name}: atendimento do WhatsApp comercial com triagem, agendamento e avisos aos sócios.</p>
      </header>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#101828]">Conexões</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTIONS.map(([label, keys]) => {
            const ok = keys.every((key) => Boolean(process.env[key]));
            return (
              <li key={label} className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm">
                <span className="text-[#344054]">{label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"}`}>{ok ? "Conectado" : "Pendente"}</span>
              </li>
            );
          })}
          <li className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm">
            <span className="text-[#344054]">Google Agenda{settings?.googleAccountEmail ? ` (${settings.googleAccountEmail})` : ""}</span>
            <a href="/api/admin/assistant-calendar-oauth/start" className={`rounded-full px-2 py-0.5 text-xs font-medium ${settings?.googleRefreshTokenEnc ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"}`}>
              {settings?.googleRefreshTokenEnc ? "Conectado · trocar" : "Conectar"}
            </a>
          </li>
        </ul>
      </section>

      <AssistantSettingsForm initialEnabled={settings?.enabled ?? false} initialConfig={config} calendars={calendars} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Próximas reuniões</h2>
          {bookings.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#667085]">Nenhuma reunião agendada pela assistente.</p>
          ) : (
            <ul className="divide-y divide-[#EEF0F3] text-sm">
              {bookings.map((b) => (
                <li key={b.id} className="flex justify-between py-2">
                  <span>{b.conversation.profileName ?? `+${b.conversation.phone}`}</span>
                  <span className="text-[#667085]">
                    {b.startsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} · {b.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <HumanConversations conversations={humanConversations.map((c) => ({ id: c.id, name: c.profileName ?? `+${c.phone}`, updatedAt: c.updatedAt.toISOString() }))} />
      </section>
    </div>
  );
}
