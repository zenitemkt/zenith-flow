import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { META_OAUTH_PENDING_COOKIE, decodeMetaOAuthPending } from "@/lib/meta-oauth-pending";
import type { MetaAdAccount } from "@/lib/meta-ads";
import { ConnectMetaButton } from "./ConnectMetaButton";
import { DisconnectMetaButton } from "./DisconnectMetaButton";
import { MetaOAuthResultToast } from "./MetaOAuthResultToast";
import { ChooseMetaAccountForm } from "./ChooseMetaAccountForm";
import { MetaPixelIdForm } from "./MetaPixelIdForm";
import { Ga4MeasurementIdForm } from "./Ga4MeasurementIdForm";
import { SendTestMetaEventButton } from "./SendTestMetaEventButton";
import { getDeliveryQualityStats } from "@/lib/tracking-quality";

const DELIVERY_DESTINATION_LABELS: Record<string, string> = { META: "Meta", GA4: "GA4" };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  REVOKED: "Revogada",
  ERROR: "Com erro",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-[#ECFDF3] text-[#027A48]",
  EXPIRED: "bg-[#FFFAEB] text-[#B54708]",
  REVOKED: "bg-[#F2F4F7] text-[#667085]",
  ERROR: "bg-[#FEF3F2] text-[#B42318]",
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-[#12B76A]",
  EXPIRED: "bg-[#F79009]",
  REVOKED: "bg-[#98A2B3]",
  ERROR: "bg-[#F04438]",
};

interface PageProps {
  searchParams: { meta?: string };
}

export default async function TraqueamentoPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const canManage = canManageIntegrations(membership.role);
  const metaConnection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } },
  });

  const agencyGa4 = await prisma.agency.findUnique({
    where: { id: membership.agencyId },
    select: { ga4MeasurementId: true },
  });

  const last30Days = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), lt: new Date() };
  const [recentDeliveries, qualityStats, commercialDeliveries] = await Promise.all([
    metaConnection
      ? prisma.eventDelivery.findMany({
          where: { agencyId: membership.agencyId },
          orderBy: { attemptedAt: "desc" },
          take: 10,
          include: { trackingEvent: { select: { eventName: true } } },
        })
      : Promise.resolve([]),
    getDeliveryQualityStats(membership.agencyId, last30Days),
    prisma.commercialMetaEvent.findMany({ where: { agencyId: membership.agencyId }, orderBy: { attemptedAt: "desc" }, take: 12 }),
  ]);

  let pendingCandidates: MetaAdAccount[] = [];
  if (searchParams.meta === "choose_account") {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(META_OAUTH_PENDING_COOKIE)?.value;
    const pending = cookieValue ? decodeMetaOAuthPending(cookieValue) : null;
    if (pending && pending.agencyId === membership.agencyId) {
      pendingCandidates = pending.candidates;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <MetaOAuthResultToast />
      </Suspense>

      {canManage && pendingCandidates.length > 0 && <ChooseMetaAccountForm candidates={pendingCandidates} />}

      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Conexões</h1>
        <p className="text-sm text-[#667085]">
          Conexões com as plataformas de anúncio de {membership.agency.name} (seções 37/38 do manual). Com o Pixel ID
          configurado, eventos de página/formulário já são enviados pra Meta pela Conversions API, deduplicados com o
          Pixel do navegador. Ler campanhas/métricas automaticamente ainda é uma próxima fatia.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#EEF0F3] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[#101828]">Meta Ads</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
                  metaConnection ? STATUS_STYLES[metaConnection.status] : "bg-[#F2F4F7] text-[#667085]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    metaConnection ? STATUS_DOT[metaConnection.status] : "bg-[#98A2B3]"
                  }`}
                />
                {metaConnection ? STATUS_LABELS[metaConnection.status] : "Não conectada"}
              </span>
            </div>
            {metaConnection ? (
              <p className="max-w-2xl text-sm text-[#667085]">
                Conta <span className="font-medium text-[#344054]">{metaConnection.externalAccountName}</span> (
                {metaConnection.externalAccountId})
                {metaConnection.tokenExpiresAt && (
                  <>
                    {" "}
                    — acesso válido até{" "}
                    <span className="font-medium text-[#344054]">
                      {metaConnection.tokenExpiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </>
                )}
              </p>
            ) : (
              <p className="max-w-2xl text-sm text-[#667085]">
                Conecte a conta de anúncios da agência pra ler campanhas e (numa próxima fatia) mandar eventos de
                conversão automaticamente.
              </p>
            )}
          </div>
          {canManage && (metaConnection ? <DisconnectMetaButton /> : <ConnectMetaButton />)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F9FAFB] px-4 py-3 text-xs text-[#667085]">
          <span>O token de acesso fica criptografado e nunca é exibido nesta tela.</span>
          <span>Desconectar não apaga campanhas ou métricas já lidas.</span>
        </div>
        {metaConnection && canManage && <MetaPixelIdForm initialPixelId={metaConnection.metaPixelId} />}
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#EEF0F3] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[#101828]">Google Analytics 4</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
                  agencyGa4?.ga4MeasurementId ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F2F4F7] text-[#667085]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    agencyGa4?.ga4MeasurementId ? "bg-[#12B76A]" : "bg-[#98A2B3]"
                  }`}
                />
                {agencyGa4?.ga4MeasurementId ? "Configurado" : "Não configurado"}
              </span>
            </div>
            <p className="max-w-2xl text-sm text-[#667085]">
              Tag no navegador (`gtag.js`) — não é conexão OAuth, só precisa do Measurement ID da propriedade GA4.
            </p>
          </div>
        </div>
        {canManage && <Ga4MeasurementIdForm initialMeasurementId={agencyGa4?.ga4MeasurementId ?? null} />}
      </section>

      {metaConnection && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="mb-5 border-b border-[#EEF0F3] pb-5">
            <div className="mb-3"><h2 className="text-sm font-semibold text-[#101828]">Eventos do funil comercial</h2><p className="mt-1 text-xs text-[#667085]">Enviados pelo servidor quando o CRM avança, com deduplicação por negociação.</p></div>
            <div className="mb-4 grid gap-2 sm:grid-cols-4">{[["Lead", "Formulário enviado"], ["QualifiedLead", "Lead qualificado"], ["ProposalSent", "Proposta enviada"], ["Purchase", "Pagamento recebido"]].map(([event, trigger]) => <div key={event} className="rounded-lg border border-[#EEF0F3] p-3"><p className="text-sm font-semibold text-[#101828]">{event}</p><p className="mt-1 text-xs text-[#667085]">{trigger}</p><span className="mt-2 inline-flex rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#027A48]">Ativo</span></div>)}</div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Últimos eventos comerciais</h3>
            {commercialDeliveries.length === 0 ? <p className="text-sm text-[#98A2B3]">Nenhum evento comercial enviado ainda.</p> : <div className="flex flex-col gap-1.5">{commercialDeliveries.map((delivery) => <div key={delivery.id} className="flex items-start justify-between gap-3 text-sm"><div><span className="font-medium text-[#101828]">{delivery.eventName}</span><span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${delivery.status === "SENT" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"}`}>{delivery.status === "SENT" ? "Enviado" : "Falhou"}</span>{delivery.valueCents !== null && <span className="ml-2 text-xs text-[#667085]">R$ {(delivery.valueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}{delivery.error && <p className="mt-1 text-xs text-[#B42318]">{delivery.error}</p>}</div><span className="shrink-0 text-xs text-[#98A2B3]">{delivery.attemptedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></div>)}</div>}
          </div>

          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#101828]">Qualidade do envio</h2>
            {canManage && metaConnection.metaPixelId && <SendTestMetaEventButton />}
          </div>
          <p className="mb-4 text-xs text-[#98A2B3]">Últimos 30 dias (seções 5/6 do manual) — diagnóstico de entrega e consentimento.</p>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#EEF0F3] p-3">
              <p className="text-xl font-semibold text-[#101828]">{qualityStats.matchQuality.pct}%</p>
              <p className="text-xs text-[#667085]">
                dos eventos de lead com e-mail/telefone pra &quot;Advanced Matching&quot; ({qualityStats.matchQuality.withIdentifier}/
                {qualityStats.matchQuality.total})
              </p>
            </div>
            <div className="rounded-lg border border-[#EEF0F3] p-3">
              <p className="text-xl font-semibold text-[#101828]">{qualityStats.consentAcceptance.pct}%</p>
              <p className="text-xs text-[#667085]">
                dos visitantes aceitaram analytics ({qualityStats.consentAcceptance.accepted}/{qualityStats.consentAcceptance.total})
                {qualityStats.consentAcceptance.total > 0 && qualityStats.consentAcceptance.pct < 50 && (
                  <span className="mt-1 block font-medium text-[#B54708]">
                    Mais da metade está recusando — boa parte dos eventos de página/clique está sendo descartada antes de
                    chegar na Meta/GA4.
                  </span>
                )}
              </p>
            </div>
          </div>

          {qualityStats.byDestinationStatus.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {qualityStats.byDestinationStatus.map((group) => (
                <span
                  key={`${group.destination}-${group.status}`}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    group.status === "SENT" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"
                  }`}
                >
                  {DELIVERY_DESTINATION_LABELS[group.destination] ?? group.destination} ·{" "}
                  {group.status === "SENT" ? "Enviados" : "Falharam"}: {group.count}
                </span>
              ))}
            </div>
          )}

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Últimos envios</h3>
          {recentDeliveries.length === 0 ? (
            <p className="text-sm text-[#98A2B3]">Nenhuma tentativa de envio registrada ainda.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-[#101828]">{delivery.trackingEvent.eventName}</span>
                    <span className="ml-2 text-xs text-[#98A2B3]">{DELIVERY_DESTINATION_LABELS[delivery.destination] ?? delivery.destination}</span>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        delivery.status === "SENT" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"
                      }`}
                    >
                      {delivery.status === "SENT" ? "Enviado" : "Falhou"}
                    </span>
                    {delivery.error && <p className="mt-0.5 break-words text-xs text-[#B42318]">{delivery.error}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-[#98A2B3]">{delivery.attemptedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#101828]">Google Ads</h2>
        <p className="text-sm text-[#98A2B3]">Ainda não conectado — próxima fatia.</p>
      </section>
    </div>
  );
}
