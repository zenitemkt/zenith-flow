import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { generateTrackingWriteKey } from "@/lib/tracking-server";
import { prisma } from "@zenite-mkt/db";
import { RotateWriteKeyButton } from "./RotateWriteKeyButton";
import { SendTestEventButton } from "./SendTestEventButton";
import { SiteLeadIntegrationActions } from "./SiteLeadIntegrationActions";

const SITE_LEAD_SOURCE = "Site Zenite Hub";

export default async function IntegracoesPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  let writeKey = membership.agency.trackingWriteKey;
  if (!writeKey) {
    writeKey = generateTrackingWriteKey();
    await prisma.agency.update({ where: { id: membership.agencyId }, data: { trackingWriteKey: writeKey } });
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [totalEvents, eventsLast24h, totalVisitors, identifiedVisitors, lastEvents, siteLeadCount, lastSiteLead] = await Promise.all([
    prisma.trackingEvent.count({ where: { agencyId: membership.agencyId } }),
    prisma.trackingEvent.count({ where: { agencyId: membership.agencyId, receivedAt: { gte: oneDayAgo } } }),
    prisma.trackingVisitor.count({ where: { agencyId: membership.agencyId } }),
    prisma.trackingVisitor.count({ where: { agencyId: membership.agencyId, leadId: { not: null } } }),
    prisma.trackingEvent.findMany({
      where: { agencyId: membership.agencyId },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: { id: true, eventName: true, url: true, occurredAt: true, receivedAt: true },
    }),
    prisma.leadSubmission.count({ where: { agencyId: membership.agencyId, source: SITE_LEAD_SOURCE } }),
    prisma.leadSubmission.findFirst({
      where: { agencyId: membership.agencyId, source: SITE_LEAD_SOURCE },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const siteLeadConfigured =
    Boolean(process.env.SITE_LEADS_SECRET) && process.env.SITE_LEADS_AGENCY_ID === membership.agencyId;
  const siteLeadEnabled = siteLeadConfigured && membership.agency.siteLeadIntegrationEnabled;
  const canManage = canManageIntegrations(membership.role);

  const snippetExample = `fetch("https://SEU_DOMINIO_ZENITE_FLOW/api/collect/v1/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    writeKey: "${writeKey}",
    visitorId: localStorage.getItem("zf_visitor_id"),
    sessionId: sessionStorage.getItem("zf_session_id"),
    events: [{
      eventName: "page_view",
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      url: location.href,
      referrer: document.referrer,
      consent: { essencial: true, analytics: true, marketing: false, personalizacao: false },
    }],
  }),
}).then((r) => r.json()).then(({ visitorId, sessionId }) => {
  localStorage.setItem("zf_visitor_id", visitorId);
  sessionStorage.setItem("zf_session_id", sessionId);
});`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Integrações</h1>
        <p className="text-sm text-[#667085]">
          Tracking first-party do site/landing pages de {membership.agency.name} (seção 34 do manual) — visitantes
          identificados por e-mail viram Leads automaticamente em <span className="font-medium">Comercial → Leads</span>.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#EEF0F3] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[#101828]">Zenite Hub — Formulário de orçamento</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
                  siteLeadEnabled ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F2F4F7] text-[#667085]"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${siteLeadEnabled ? "bg-[#12B76A]" : "bg-[#98A2B3]"}`} />
                {siteLeadEnabled ? "Ativa" : siteLeadConfigured ? "Desconectada" : "Não configurada"}
              </span>
            </div>
            <p className="max-w-2xl text-sm text-[#667085]">
              Recebe os dados enviados em <span className="font-medium text-[#344054]">hubzenite.com.br/orcamento</span> e
              cria o contato automaticamente em <span className="font-medium text-[#344054]">Comercial → Leads</span>.
            </p>
          </div>
          <SiteLeadIntegrationActions enabled={siteLeadEnabled} configured={siteLeadConfigured} canManage={canManage} />
        </div>

        <div className="grid gap-px bg-[#EEF0F3] sm:grid-cols-3">
          <div className="bg-white p-4">
            <p className="text-xs text-[#667085]">Preenchimentos recebidos</p>
            <p className="mt-1 text-xl font-semibold text-[#101828]">{siteLeadCount}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs text-[#667085]">Último recebimento</p>
            <p className="mt-1 text-sm font-semibold text-[#101828]">
              {lastSiteLead ? lastSiteLead.createdAt.toLocaleString("pt-BR") : "Nenhum preenchimento recebido"}
            </p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs text-[#667085]">Origem registrada</p>
            <p className="mt-1 text-sm font-semibold text-[#101828]">{SITE_LEAD_SOURCE}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F9FAFB] px-4 py-3 text-xs text-[#667085]">
          <span>A credencial fica protegida na Vercel e nunca é exibida nesta tela.</span>
          <span>Desconectar não apaga leads já recebidos.</span>
        </div>
      </section>
      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#101828]">Chave do coletor</h2>
          {canManageIntegrations(membership.role) && <RotateWriteKeyButton />}
        </div>
        <p className="mb-2 rounded-lg bg-[#F9FAFB] px-3 py-2 font-mono text-sm text-[#344054]">{writeKey}</p>
        <p className="mb-3 text-xs text-[#98A2B3]">
          Chave pública (não é secreta) — vai embutida no código do site, mesmo modelo do Google Analytics ou do Meta
          Pixel. A segurança do coletor está na validação de consentimento e de schema, não no sigilo desta chave.
        </p>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Exemplo de chamada</p>
        <pre className="overflow-x-auto rounded-lg bg-[#101828] p-3 text-xs text-[#D0D5DD]">
          <code>{snippetExample}</code>
        </pre>
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#101828]">Saúde da integração</h2>
          <SendTestEventButton writeKey={writeKey} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{totalEvents}</p>
            <p className="text-xs text-[#667085]">eventos recebidos (total)</p>
          </div>
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{eventsLast24h}</p>
            <p className="text-xs text-[#667085]">eventos nas últimas 24h</p>
          </div>
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{totalVisitors}</p>
            <p className="text-xs text-[#667085]">visitantes únicos</p>
          </div>
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{identifiedVisitors}</p>
            <p className="text-xs text-[#667085]">identificados (viraram Lead)</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#101828]">Últimos eventos</h2>
        {lastEvents.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">
            Nenhum evento recebido ainda — use &quot;Enviar evento de teste&quot; acima ou instale o snippet no site.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lastEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-[#101828]">{event.eventName}</span>
                  {event.url && <span className="ml-2 truncate text-xs text-[#98A2B3]">{event.url}</span>}
                </div>
                <span className="whitespace-nowrap text-xs text-[#98A2B3]">
                  {event.receivedAt.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
