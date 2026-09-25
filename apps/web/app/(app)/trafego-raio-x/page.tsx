import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE_CLASS } from "@/lib/campaigns";
import { computeCampaignTotals } from "@/lib/campaign-xray";
import { formatCents } from "@/lib/finance";
import { ClientFilterPills } from "@/app/_components/ClientFilterPills";
import { prisma } from "@zenite-mkt/db";
import type { CampaignStatus } from "@zenite-mkt/db";
import { CampaignXrayTree } from "./CampaignXrayTree";
import { TrafficMap } from "./TrafficMap";

interface PageProps {
  searchParams: { clientId?: string; status?: string; days?: string };
}

const STATUS_FILTERS: { value: CampaignStatus | "TODAS"; label: string }[] = [
  { value: "ATIVA", label: "Ativas" },
  { value: "PAUSADA", label: "Pausadas" },
  { value: "ENCERRADA", label: "Encerradas" },
  { value: "TODAS", label: "Todas" },
];

const PERIOD_OPTIONS = [7, 30, 90];

export default async function TrafficXrayPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const activeClientId = searchParams.clientId;
  const statusFilter: CampaignStatus | "TODAS" = STATUS_FILTERS.some((s) => s.value === searchParams.status)
    ? (searchParams.status as CampaignStatus | "TODAS")
    : "ATIVA";
  const days = PERIOD_OPTIONS.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;

  const periodStart = new Date();
  periodStart.setUTCDate(periodStart.getUTCDate() - days);
  periodStart.setUTCHours(0, 0, 0, 0);

  const [campaigns, clients] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        agencyId: membership.agencyId,
        ...(activeClientId ? { clientId: activeClientId } : {}),
        ...(statusFilter === "TODAS" ? {} : { status: statusFilter }),
      },
      include: {
        client: { select: { id: true, name: true } },
        dailyMetrics: { where: { date: { gte: periodStart } } },
        adSets: { orderBy: { createdAt: "asc" }, include: { ads: { orderBy: { createdAt: "asc" } } } },
        geoTargets: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = campaigns.map((campaign) => ({
    campaign,
    totals: computeCampaignTotals(campaign.dailyMetrics),
  }));

  const blended = computeCampaignTotals(campaigns.flatMap((c) => c.dailyMetrics));
  const allGeoTargets = campaigns.flatMap((c) =>
    c.geoTargets.map((g) => ({ ...g, campaignName: c.name, campaignId: c.id })),
  );

  function buildHref(overrides: { clientId?: string; status?: string; days?: number }) {
    const params = new URLSearchParams();
    const nextClientId = overrides.clientId !== undefined ? overrides.clientId : activeClientId;
    const nextStatus = overrides.status !== undefined ? overrides.status : statusFilter;
    const nextDays = overrides.days !== undefined ? overrides.days : days;
    if (nextClientId) params.set("clientId", nextClientId);
    if (nextStatus !== "ATIVA") params.set("status", nextStatus);
    if (nextDays !== 30) params.set("days", String(nextDays));
    const qs = params.toString();
    return qs ? `/trafego-raio-x?${qs}` : "/trafego-raio-x";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Tráfego - Raio X</h1>
        <p className="text-sm text-[#667085]">
          Espelho das campanhas de mídia paga (Meta, Google e outros canais) sem precisar abrir o painel de cada
          plataforma — dados digitados à mão nesta fatia, sem conector real ainda (seção 38 do manual).{" "}
          <Link href="/comercial/campanhas" className="font-medium text-[#FF2B00] hover:underline">
            Gerenciar campanhas
          </Link>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s.value}
              href={buildHref({ status: s.value })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                statusFilter === s.value
                  ? "bg-[#FF2B00] text-white"
                  : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-[#667085]">
          Período:
          {PERIOD_OPTIONS.map((d) => (
            <Link
              key={d}
              href={buildHref({ days: d })}
              className={`rounded-full px-3 py-1.5 font-medium ${
                days === d ? "bg-[#101828] text-white" : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
              }`}
            >
              {d} dias
            </Link>
          ))}
        </div>
      </div>

      <ClientFilterPills
        clients={clients}
        activeClientId={activeClientId}
        buildHref={(clientId) => buildHref({ clientId })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{formatCents(blended.spendCents)}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">gasto no período ({days} dias)</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{blended.clicks.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">cliques</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{blended.frequency === null ? "—" : blended.frequency.toFixed(2)}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">frequência média (impressões / alcance)</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{blended.roas === null ? "—" : `${blended.roas.toFixed(2)}x`}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">
            ROAS combinado{blended.roi !== null && ` · ROI ${Math.round(blended.roi * 100)}%`}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhuma campanha {statusFilter === "TODAS" ? "" : CAMPAIGN_STATUS_LABELS[statusFilter as CampaignStatus].toLowerCase() + " "}
            por aqui.{" "}
            <Link href="/comercial/campanhas" className="font-medium text-[#FF2B00] hover:underline">
              Criar campanha
            </Link>
          </p>
        </div>
      ) : (
        <CampaignXrayTree
          rows={rows.map(({ campaign, totals }) => ({
            id: campaign.id,
            name: campaign.name,
            channel: campaign.channel,
            status: campaign.status,
            statusLabel: CAMPAIGN_STATUS_LABELS[campaign.status],
            statusBadgeClass: CAMPAIGN_STATUS_BADGE_CLASS[campaign.status],
            clientName: campaign.client?.name ?? null,
            totals,
            adSets: campaign.adSets.map((adSet) => ({
              id: adSet.id,
              name: adSet.name,
              budgetCents: adSet.budgetCents,
              targetingSummary: adSet.targetingSummary,
              active: adSet.active,
              ads: adSet.ads.map((ad) => ({
                id: ad.id,
                name: ad.name,
                creativeNote: ad.creativeNote,
                assetUrl: ad.assetUrl,
                active: ad.active,
              })),
            })),
          }))}
        />
      )}

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-1">
          <h2 className="text-sm font-semibold text-[#101828]">Mapa do Tráfego</h2>
          <p className="text-xs text-[#98A2B3]">
            Onde as campanhas mostradas acima estão sendo veiculadas — pino por cidade, ou círculo quando a
            segmentação usa raio. Preenchido à mão (seção 36); sem geocodificação automática nesta fatia.
          </p>
        </div>
        <TrafficMap points={allGeoTargets} />
      </section>
    </div>
  );
}
