import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { resolvePipelinePeriod } from "@/lib/pipeline-period";
import { resolveTouchpoint } from "@/lib/attribution";
import { TrackingPeriodFilter } from "./TrackingPeriodFilter";
import type { FunnelStage } from "@/app/_components/charts/FunnelChart";

const FunnelChart = dynamic(() =>
  import("@/app/_components/charts/FunnelChart").then((module) => module.FunnelChart),
);

interface PageProps {
  searchParams: { period?: string; year?: string; month?: string; from?: string; to?: string };
}

export default async function TrackingOverviewPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  const selectedPeriod = resolvePipelinePeriod({ ...searchParams, period: searchParams.period ?? "last30" });
  const range = selectedPeriod.createdAt;
  const agencyId = membership.agencyId;

  const [visitorsCount, sessions, campaigns, leadsCount, proposalsSentCount, wonCount, totalEventsCount, pageViews, eventGroups] =
    await Promise.all([
      prisma.trackingVisitor.count({ where: { agencyId, ...(range ? { firstSeenAt: range } : {}) } }),
      prisma.trackingSession.findMany({
        where: { visitor: { agencyId }, ...(range ? { startedAt: range } : {}) },
      }),
      prisma.campaign.findMany({ where: { agencyId } }),
      prisma.lead.count({ where: { agencyId, ...(range ? { createdAt: range } : {}) } }),
      prisma.proposal.count({ where: { agencyId, sentAt: range ? range : { not: null } } }),
      prisma.opportunity.count({ where: { agencyId, status: "WON", ...(range ? { updatedAt: range } : {}) } }),
      prisma.trackingEvent.count({ where: { agencyId, ...(range ? { occurredAt: range } : {}) } }),
      prisma.trackingEvent.findMany({
        where: { agencyId, eventName: "page_view", ...(range ? { occurredAt: range } : {}) },
        select: { url: true },
      }),
      prisma.trackingEvent.groupBy({
        by: ["eventName"],
        where: { agencyId, ...(range ? { occurredAt: range } : {}) },
        _count: { _all: true },
      }),
    ]);

  const eventCounts = new Map(eventGroups.map((group) => [group.eventName, group._count._all]));
  const countEvent = (name: string) => eventCounts.get(name) ?? 0;
  const engagedSessions = countEvent("engaged_session");
  const serviceViews = countEvent("service_view");
  const whatsappClicks = countEvent("whatsapp_click");
  const formViews = countEvent("form_view");
  const formStarts = countEvent("form_start");
  const formSubmits = countEvent("form_submit");
  const formAbandons = countEvent("form_abandon");
  const engagementRate = sessions.length > 0 ? Math.round((engagedSessions / sessions.length) * 100) : 0;
  const formCompletionRate = formStarts > 0 ? Math.round((formSubmits / formStarts) * 100) : 0;

  const channelCounts = new Map<string, number>();
  for (const trackingSession of sessions) {
    const touchpoint = resolveTouchpoint(trackingSession, campaigns);
    channelCounts.set(touchpoint.channel, (channelCounts.get(touchpoint.channel) ?? 0) + 1);
  }
  const topChannels = Array.from(channelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxChannelCount = topChannels.length > 0 ? Math.max(...topChannels.map(([, count]) => count)) : 0;

  const pageCounts = new Map<string, number>();
  for (const pageView of pageViews) {
    const path = pageView.url ? new URL(pageView.url).pathname : "(sem URL)";
    pageCounts.set(path, (pageCounts.get(path) ?? 0) + 1);
  }
  const topPages = Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const sessionsByVisitor = new Map<string, number>();
  for (const trackingSession of sessions) {
    sessionsByVisitor.set(trackingSession.visitorId, (sessionsByVisitor.get(trackingSession.visitorId) ?? 0) + 1);
  }
  const returningVisitorsCount = Array.from(sessionsByVisitor.values()).filter((count) => count > 1).length;

  const cityCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  for (const trackingSession of sessions) {
    const cityLabel = trackingSession.city
      ? `${trackingSession.city}${trackingSession.region ? ` (${trackingSession.region})` : ""}`
      : null;
    if (cityLabel) cityCounts.set(cityLabel, (cityCounts.get(cityLabel) ?? 0) + 1);
    const deviceLabel = trackingSession.deviceType ?? "desconhecido";
    deviceCounts.set(deviceLabel, (deviceCounts.get(deviceLabel) ?? 0) + 1);
  }
  const topCities = Array.from(cityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const deviceTotal = sessions.length;
  const deviceBreakdown = Array.from(deviceCounts.entries()).sort((a, b) => b[1] - a[1]);
  const DEVICE_LABELS: Record<string, string> = {
    desktop: "Computador",
    mobile: "Celular",
    tablet: "Tablet",
    desconhecido: "Desconhecido",
  };

  const funnelData: FunnelStage[] = [
    { label: "Visitantes", value: visitorsCount },
    { label: "Leads", value: leadsCount },
    { label: "Propostas enviadas", value: proposalsSentCount },
    { label: "Vendas", value: wonCount },
  ];
  const hasFunnelData = funnelData.some((stage) => stage.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Traqueamento</h1>
        <p className="text-sm text-[#667085]">
          Acessos ao site e o que eles viraram no comercial de {membership.agency.name} (seções 34/36/39 do manual).
          Saúde do coletor e eventos brutos ficam em <span className="font-medium">Sistema → Integrações</span>;
          conexão com Meta/Google Ads fica em <span className="font-medium">Conexões</span>, ao lado.
        </p>
      </div>

      <TrackingPeriodFilter
        initialPeriod={selectedPeriod.period}
        initialYear={searchParams.year}
        initialMonth={searchParams.month}
        initialFrom={searchParams.from}
        initialTo={searchParams.to}
      />

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#101828]">Visão geral de acessos</h2>
          <p className="text-xs text-[#667085]">{selectedPeriod.label}.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{visitorsCount}</p>
            <p className="text-xs text-[#667085]">visitantes únicos</p>
          </div>
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{returningVisitorsCount}</p>
            <p className="text-xs text-[#667085]">visitantes recorrentes</p>
          </div>
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{sessions.length}</p>
            <p className="text-xs text-[#667085]">sessões</p>
          </div>
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{totalEventsCount}</p>
            <p className="text-xs text-[#667085]">eventos registrados</p>
          </div>
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{leadsCount}</p>
            <p className="text-xs text-[#667085]">leads no período</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#101828]">Comportamento e formulários</h2>
          <p className="text-xs text-[#667085]">Sinais de interesse e avanço dos visitantes no site durante {selectedPeriod.label.toLowerCase()}.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [engagedSessions, "sessões engajadas", engagementRate + "% das sessões"],
            [serviceViews, "serviços visualizados", "interesse em oferta"],
            [whatsappClicks, "cliques no WhatsApp", "contato direto"],
            [formViews, "visualizações do formulário", "chegaram ao orçamento"],
            [formStarts, "formulários iniciados", "começaram a preencher"],
            [formSubmits, "formulários enviados", formCompletionRate + "% de conclusão"],
            [formAbandons, "formulários abandonados", "iniciaram e não enviaram"],
            [countEvent("form_error"), "erros de formulário", "campos inválidos"],
          ].map(([value, label, detail]) => (
            <div key={String(label)} className="rounded-lg border border-[#EEF0F3] p-3">
              <p className="text-xl font-semibold text-[#101828]">{value}</p>
              <p className="text-xs font-medium text-[#344054]">{label}</p>
              <p className="mt-0.5 text-[11px] text-[#98A2B3]">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Páginas mais vistas</h2>
          {topPages.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#667085]">Nenhuma página vista neste período.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {topPages.map(([path, count]) => (
                <div key={path} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-[#344054]" title={path}>{path}</span>
                  <span className="shrink-0 font-semibold text-[#101828]">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Por cidade e aparelho</h2>
          {topCities.length === 0 ? (
            <p className="py-2 text-sm text-[#667085]">Nenhuma cidade identificada neste período.</p>
          ) : (
            <div className="mb-4 flex flex-col gap-1.5">
              {topCities.map(([city, count]) => (
                <div key={city} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-[#344054]">{city}</span>
                  <span className="shrink-0 font-semibold text-[#101828]">{count}</span>
                </div>
              ))}
            </div>
          )}
          {deviceBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[#EEF0F3] pt-3">
              {deviceBreakdown.map(([device, count]) => (
                <span key={device} className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#344054]">
                  {DEVICE_LABELS[device] ?? device}: {deviceTotal > 0 ? Math.round((count / deviceTotal) * 100) : 0}%
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#101828]">Fontes de tráfego</h2>
          <p className="text-xs text-[#667085]">
            Canal de origem de cada sessão — UTM quando presente, casado com Campanhas (seção 36); senão referrer
            (&quot;Orgânico&quot;) ou acesso direto. Mesma lógica de atribuição usada em Comercial → Campanhas.
          </p>
        </div>
        {topChannels.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#667085]">Nenhuma sessão registrada neste período.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topChannels.map(([channel, count]) => (
              <div key={channel} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-[#344054]" title={channel}>{channel}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F2F4F7]">
                  <div
                    className="h-full rounded-full bg-[#FF2B00]"
                    style={{ width: `${maxChannelCount > 0 ? (count / maxChannelCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold text-[#101828]">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#101828]">Funil visitante → venda</h2>
          <p className="text-xs text-[#667085]">
            Aproximado: nem todo Lead nasce de uma visita ao site rastreada (pode vir de indicação, WhatsApp direto
            etc.) — este funil mostra o volume de cada etapa no período, não uma jornada garantida 1:1 do mesmo
            visitante até a venda.
          </p>
        </div>
        {hasFunnelData ? (
          <div className="mx-auto w-full max-w-md"><FunnelChart data={funnelData} orientation="vertical" color="#FF2B00" layers={3} /></div>
        ) : (
          <p className="py-6 text-center text-sm text-[#667085]">Nenhum dado neste período.</p>
        )}
      </section>
    </div>
  );
}
