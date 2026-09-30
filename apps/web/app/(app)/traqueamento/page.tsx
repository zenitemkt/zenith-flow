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

  const [visitorsCount, sessions, campaigns, leadsCount, proposalsSentCount, wonCount, totalEventsCount] =
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
    ]);

  const channelCounts = new Map<string, number>();
  for (const trackingSession of sessions) {
    const touchpoint = resolveTouchpoint(trackingSession, campaigns);
    channelCounts.set(touchpoint.channel, (channelCounts.get(touchpoint.channel) ?? 0) + 1);
  }
  const topChannels = Array.from(channelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxChannelCount = topChannels.length > 0 ? Math.max(...topChannels.map(([, count]) => count)) : 0;

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xl font-semibold text-[#101828]">{visitorsCount}</p>
            <p className="text-xs text-[#667085]">visitantes únicos</p>
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
