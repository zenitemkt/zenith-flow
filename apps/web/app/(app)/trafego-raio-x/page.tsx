import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE_CLASS } from "@/lib/campaigns";
import { computeCampaignTotals } from "@/lib/campaign-xray";
import { formatCents } from "@/lib/finance";
import { ClientFilterSelect } from "@/app/_components/ClientFilterSelect";
import { prisma } from "@zenite-mkt/db";
import type { CampaignStatus } from "@zenite-mkt/db";
import { CampaignXrayTree } from "./CampaignXrayTree";
import { TrafficMap } from "./TrafficMap";
import { DailyChart, type DailyPoint } from "./DailyChart";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { CPL_LEVEL_LABEL, cplCents, cplLevel, ctr, frequency, sumLevel } from "@/lib/xray-metrics";
import { SyncMetaCampaignsButton } from "../comercial/campanhas/SyncMetaCampaignsButton";
import { canManageIntegrations } from "@/lib/rbac";
import { isMetaSyncStale } from "@/lib/meta-campaign-sync";
import { getHiddenClientIds, visibleByOptionalClientWhere, visibleClientWhere } from "@/lib/client-access";

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
  const hidden = await getHiddenClientIds(membership.agencyId, session.user.id);

  const activeClientId = searchParams.clientId;
  const statusFilter: CampaignStatus | "TODAS" = STATUS_FILTERS.some((s) => s.value === searchParams.status)
    ? (searchParams.status as CampaignStatus | "TODAS")
    : "ATIVA";
  const days = PERIOD_OPTIONS.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;

  const periodStart = new Date();
  periodStart.setUTCDate(periodStart.getUTCDate() - days);
  periodStart.setUTCHours(0, 0, 0, 0);

  const [campaigns, clients, metaConnection, trafficSettings, recommendations, history] = await Promise.all([
    prisma.campaign.findMany({
      where: { AND: [visibleByOptionalClientWhere(hidden)],
        agencyId: membership.agencyId,
        ...(activeClientId ? { clientId: activeClientId } : {}),
        ...(statusFilter === "TODAS" ? {} : { status: statusFilter }),
      },
      include: {
        client: { select: { id: true, name: true } },
        dailyMetrics: { where: { date: { gte: periodStart } } },
        adSets: {
          orderBy: { createdAt: "asc" },
          include: {
            dailyMetrics: { where: { date: { gte: periodStart } } },
            ads: { orderBy: { createdAt: "asc" }, include: { dailyMetrics: { where: { date: { gte: periodStart } } } } },
          },
        },
        geoTargets: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { AND: [visibleClientWhere(hidden)], agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.adAccountConnection.findUnique({
      where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } },
      select: { status: true, lastValidatedAt: true },
    }),
    prisma.trafficSettings.findUnique({ where: { agencyId: membership.agencyId }, select: { cplGoodCents: true, cplMaxCents: true } }),
    prisma.trafficRecommendation.findMany({ where: { agencyId: membership.agencyId, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.auditLog.findMany({ where: { agencyId: membership.agencyId, action: { startsWith: "traffic." } }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const actorIds = Array.from(new Set(history.map((h) => h.actorUserId).filter((x): x is string => Boolean(x))));
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : [];
  const actorName = (id: string | null) => {
    const u = actors.find((a) => a.id === id);
    return u?.name || u?.email || "Alguém";
  };
  const goals = { goodCents: trafficSettings?.cplGoodCents ?? null, maxCents: trafficSettings?.cplMaxCents ?? null };
  const canSyncMeta = canManageIntegrations(membership.role) && metaConnection?.status === "ACTIVE";

  const rows = campaigns.map((campaign) => ({
    campaign,
    totals: computeCampaignTotals(campaign.dailyMetrics),
  }));

  const blended = computeCampaignTotals(campaigns.flatMap((c) => c.dailyMetrics));
  const all = sumLevel(campaigns.flatMap((c) => c.dailyMetrics));
  const allCpl = cplCents(all);
  const allLevel = cplLevel(all, goals.goodCents, goals.maxCents);
  const allCtr = ctr(all);
  const allFrequency = frequency(all);

  // Gráfico diário: todos os dias do período, com zero nos dias sem gasto.
  const byDay = new Map<string, DailyPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, spendCents: 0, leads: 0 });
  }
  for (const m of campaigns.flatMap((c) => c.dailyMetrics)) {
    const point = byDay.get(m.date.toISOString().slice(0, 10));
    if (point) {
      point.spendCents += m.spendCents;
      point.leads += m.results ?? 0;
    }
  }
  const dailyPoints = Array.from(byDay.values());
  const allGeoTargets = campaigns.flatMap((c) =>
    c.geoTargets.map((g) => ({ ...g, campaignName: c.name, campaignId: c.id })),
  );

  /** Status e período fora do padrão: mantidos na URL ao trocar qualquer filtro. */
  function filterParams(nextStatus: string, nextDays: number): Record<string, string> {
    const params: Record<string, string> = {};
    if (nextStatus !== "ATIVA") params.status = nextStatus;
    if (nextDays !== 30) params.days = String(nextDays);
    return params;
  }

  function buildHref(overrides: { status?: string; days?: number }) {
    const params = new URLSearchParams();
    const nextStatus = overrides.status !== undefined ? overrides.status : statusFilter;
    const nextDays = overrides.days !== undefined ? overrides.days : days;
    if (activeClientId) params.set("clientId", activeClientId);
    for (const [key, value] of Object.entries(filterParams(nextStatus, nextDays))) params.set(key, value);
    const qs = params.toString();
    return qs ? `/trafego-raio-x?${qs}` : "/trafego-raio-x";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-lg font-semibold text-[#101828]">Tráfego - Raio X</h1>
        <p className="text-sm text-[#667085]">
          Espelho das campanhas de mídia paga (Meta, Google e outros canais) sem precisar abrir o painel de cada
          plataforma — campanhas, conjuntos e anúncios da Meta vêm da conta conectada (situação, verba, números diários e cidades no mapa), atualizados todo dia às 6h e ao abrir a página; os outros canais são digitados à mão (seção 38 do manual).{" "}
          <Link href="/trafego-raio-x/gestor?aba=campanhas" className="font-medium text-[#FF2B00] hover:underline">
            Gerenciar campanhas
          </Link>
        </p>
        </div>
        {canSyncMeta && <SyncMetaCampaignsButton autoSync={isMetaSyncStale(metaConnection?.lastValidatedAt ?? null)} />}
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

      <ClientFilterSelect
        clients={clients}
        activeClientId={activeClientId}
        basePath="/trafego-raio-x"
        params={filterParams(statusFilter, days)}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{formatCents(all.spendCents)}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">gasto no período ({days} dias)</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{all.leads.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">leads</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className={`text-2xl font-semibold ${allLevel === "good" ? "text-[#027A48]" : allLevel === "warning" ? "text-[#B54708]" : allLevel === "critical" ? "text-[#B42318]" : "text-[#101828]"}`}>
            {allCpl === null ? "—" : formatCents(allCpl)}
          </p>
          <p className="mt-1 text-xs font-medium text-[#475467]">
            custo por lead{allLevel !== "none" ? ` · ${CPL_LEVEL_LABEL[allLevel]}` : ""}
            {goals.goodCents || goals.maxCents ? (
              <span className="block font-normal text-[#98A2B3]">
                meta: {goals.goodCents ? `bom até ${formatCents(goals.goodCents)}` : ""}{goals.goodCents && goals.maxCents ? " · " : ""}{goals.maxCents ? `máx. ${formatCents(goals.maxCents)}` : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{allCtr === null ? "—" : `${(allCtr * 100).toFixed(2)}%`}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">CTR · {all.clicks.toLocaleString("pt-BR")} cliques</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{allFrequency === null ? "—" : allFrequency.toFixed(2)}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">frequência média</p>
        </div>
        {blended.resultValueCents > 0 && blended.roas !== null && (
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <p className="text-2xl font-semibold text-[#101828]">{blended.roas.toFixed(2)}x</p>
            <p className="mt-1 text-xs font-medium text-[#475467]">ROAS{blended.roi !== null && ` · ROI ${Math.round(blended.roi * 100)}%`}</p>
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <RecommendationsPanel
          canManage={canManageIntegrations(membership.role)}
          items={recommendations.map((r) => ({ id: r.id, type: r.type, level: r.level, targetName: r.targetName, campaignName: r.campaignName, reason: r.reason, suggestedBudgetCents: r.suggestedBudgetCents, createdAt: r.createdAt.toISOString() }))}
        />
      )}

      {all.spendCents > 0 && <DailyChart points={dailyPoints} />}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhuma campanha {statusFilter === "TODAS" ? "" : CAMPAIGN_STATUS_LABELS[statusFilter as CampaignStatus].toLowerCase() + " "}
            por aqui.{" "}
            <Link href="/trafego-raio-x/gestor?aba=nova" className="font-medium text-[#FF2B00] hover:underline">
              Criar campanha
            </Link>
          </p>
        </div>
      ) : (
        <CampaignXrayTree
          goals={goals}
          canManage={canManageIntegrations(membership.role)}
          rows={rows.map(({ campaign, totals }) => ({
            id: campaign.id,
            name: campaign.name,
            channel: campaign.channel,
            status: campaign.status,
            statusLabel: CAMPAIGN_STATUS_LABELS[campaign.status],
            statusBadgeClass: CAMPAIGN_STATUS_BADGE_CLASS[campaign.status],
            clientName: campaign.client?.name ?? null,
            synced: campaign.channel === "Meta Ads" && Boolean(campaign.externalId),
            budgetCents: campaign.channel === "Meta Ads" ? campaign.budgetCents : null,
            totals: sumLevel(campaign.dailyMetrics),
            roas: totals.resultValueCents > 0 ? totals.roas : null,
            adSets: campaign.adSets.map((adSet) => ({
              id: adSet.id,
              name: adSet.name,
              budgetCents: adSet.budgetCents,
              targetingSummary: adSet.targetingSummary,
              active: adSet.active,
              synced: Boolean(adSet.externalId),
              metaStatus: adSet.metaStatus,
              totals: sumLevel(adSet.dailyMetrics),
              ads: adSet.ads.map((ad) => ({
                id: ad.id,
                name: ad.name,
                creativeNote: ad.creativeNote,
                assetUrl: ad.assetUrl,
                active: ad.active,
                synced: Boolean(ad.externalId),
                metaStatus: ad.metaStatus,
                reviewFeedback: ad.reviewFeedback,
                thumbnailUrl: ad.thumbnailUrl,
                totals: sumLevel(ad.dailyMetrics),
              })),
            })),
          }))}
        />
      )}

      {history.length > 0 && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#101828]">Histórico de alterações</h2>
          <p className="mb-2 text-xs text-[#98A2B3]">Pausar, ativar e mudanças de verba feitas pelo portal.</p>
          <ul className="divide-y divide-[#F2F4F7] text-sm">
            {history.map((h) => {
              const meta = (h.metadata ?? {}) as { summary?: string; name?: string };
              return (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span className="text-[#344054]">
                    <strong className="font-medium text-[#101828]">{actorName(h.actorUserId)}</strong> {meta.summary ?? h.action} &quot;{meta.name ?? ""}&quot;
                  </span>
                  <span className="text-xs text-[#98A2B3]">{h.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-1">
          <h2 className="text-sm font-semibold text-[#101828]">Mapa do Tráfego</h2>
          <p className="text-xs text-[#98A2B3]">
            Onde as campanhas mostradas acima estão sendo veiculadas — pino por cidade, ou círculo quando a
            segmentação usa raio. Campanhas da Meta entram sozinhas pelas cidades da segmentação; outras são cadastradas à mão.
          </p>
        </div>
        <TrafficMap points={allGeoTargets} />
      </section>
    </div>
  );
}
