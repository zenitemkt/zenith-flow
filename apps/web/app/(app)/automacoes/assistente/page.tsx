import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { mergeAssistantConfig } from "@/lib/assistant/config";
import { listCalendars } from "@/lib/assistant/calendar";
import { AssistantSettingsForm, type ConnectionStatus } from "./AssistantSettingsForm";
import { HumanConversations } from "./HumanConversations";
import { MetaReviewCard } from "./MetaReviewCard";

const hasEnv = (...keys: string[]) => keys.every((key) => Boolean(process.env[key]));

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
  const whatsappOk = hasEnv("ASSISTANT_WA_TOKEN", "ASSISTANT_WA_PHONE_NUMBER_ID", "ASSISTANT_WA_VERIFY_TOKEN");

  const connections: ConnectionStatus[] = [
    { label: "WhatsApp", detail: whatsappOk ? "Número conectado em coexistência" : "Falta conectar o número", ok: whatsappOk },
    {
      label: "Google Agenda",
      detail: settings?.googleRefreshTokenEnc ? `${settings.googleAccountEmail ?? "Conta conectada"} · clique para trocar` : "Clique para conectar",
      ok: Boolean(settings?.googleRefreshTokenEnc) && config.meeting.calendarIds.length > 0,
      href: "/api/admin/assistant-calendar-oauth/start",
    },
    { label: "Inteligência (Claude)", detail: hasEnv("ANTHROPIC_API_KEY") ? "Chave configurada" : "Falta a chave", ok: hasEnv("ANTHROPIC_API_KEY") },
    { label: "Transcrição de áudio", detail: hasEnv("OPENAI_API_KEY") ? "Chave configurada" : "Falta a chave", ok: hasEnv("OPENAI_API_KEY") },
    { label: "Agendador", detail: hasEnv("ASSISTANT_CRON_SECRET") ? "Rodando a cada minuto" : "Falta configurar", ok: hasEnv("ASSISTANT_CRON_SECRET") },
    {
      label: "Avisos aos sócios",
      detail: config.notifications.partnerPhones.length ? `${config.notifications.partnerPhones.length} número(s) cadastrado(s)` : "Cadastre na aba Avisos",
      ok: config.notifications.partnerPhones.length > 0 || Boolean(config.notifications.groupId),
    },
  ];

  return (
    <div className="space-y-6">
      <AssistantSettingsForm initialEnabled={settings?.enabled ?? false} initialConfig={config} calendars={calendars} connections={connections} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#101828]">Próximas reuniões</h2>
          <p className="mb-3 text-xs text-[#667085]">Agendadas pela {config.name}.</p>
          {bookings.length === 0 ? (
            <p className="rounded-lg bg-[#F9FAFB] py-6 text-center text-sm text-[#667085]">Nenhuma reunião agendada ainda.</p>
          ) : (
            <ul className="divide-y divide-[#EEF0F3] text-sm">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-[#101828]">{b.conversation.profileName ?? `+${b.conversation.phone}`}</span>
                  <span className="flex items-center gap-2 text-[#667085]">
                    {b.startsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.status === "confirmed" ? "bg-[#ECFDF3] text-[#027A48]" : b.status === "pending_partner" ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[#F2F4F7] text-[#344054]"}`}>
                      {b.status === "confirmed" ? "Confirmada" : b.status === "pending_partner" ? "Aguardando sócios" : "Agendada"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <HumanConversations conversations={humanConversations.map((c) => ({ id: c.id, name: c.profileName ?? `+${c.phone}`, updatedAt: c.updatedAt.toISOString() }))} />
      </section>
      {!whatsappOk && <MetaReviewCard />}
    </div>
  );
}
