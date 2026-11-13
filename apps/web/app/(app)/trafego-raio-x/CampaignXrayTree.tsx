"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, Plus, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/finance";
import { CPL_LEVEL_LABEL, META_STATUS_LABEL, cplCents, cplLevel, ctr, frequency, type CplLevel, type LevelTotals } from "@/lib/xray-metrics";
import { AddAdSetModal } from "./AddAdSetModal";
import { AddAdModal } from "./AddAdModal";
import { AddGeoTargetModal } from "./AddGeoTargetModal";
import { TrafficActions } from "./TrafficActions";

/** Ligado na Meta (o próprio status), mesmo que a campanha ou o conjunto acima esteja pausado. */
const isOn = (status: string | null) => Boolean(status) && !["PAUSED", "ARCHIVED", "DELETED"].includes(status!);

interface AdRow {
  id: string;
  name: string;
  creativeNote: string | null;
  assetUrl: string | null;
  active: boolean;
  synced: boolean;
  metaStatus: string | null;
  reviewFeedback: string | null;
  thumbnailUrl: string | null;
  totals: LevelTotals;
}

interface AdSetRow {
  id: string;
  name: string;
  budgetCents: number | null;
  targetingSummary: string | null;
  active: boolean;
  synced: boolean;
  metaStatus: string | null;
  totals: LevelTotals;
  ads: AdRow[];
}

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  status: string;
  statusLabel: string;
  statusBadgeClass: string;
  clientName: string | null;
  /** Campanha da Meta (dá para pausar/ativar e mudar verba pelo portal). */
  synced: boolean;
  /** Verba diária da campanha (Advantage+); null = verba nos conjuntos. */
  budgetCents: number | null;
  totals: LevelTotals;
  /** Só mostra ROAS quando a plataforma manda valor (compras). */
  roas: number | null;
  adSets: AdSetRow[];
}

type SortKey = "spend" | "leads" | "cpl";
interface Goals {
  goodCents: number | null;
  maxCents: number | null;
}

const CPL_TEXT: Record<CplLevel, string> = { good: "text-[#027A48]", warning: "text-[#B54708]", critical: "text-[#B42318]", none: "text-[#101828]" };
const CPL_ICON: Record<CplLevel, string> = { good: "●", warning: "▲", critical: "■", none: "" };

function sortRows<T extends { totals: LevelTotals }>(rows: T[], key: SortKey): T[] {
  const value = (r: T) => (key === "spend" ? -r.totals.spendCents : key === "leads" ? -r.totals.leads : cplCents(r.totals) ?? Number.MAX_SAFE_INTEGER);
  return [...rows].sort((a, b) => value(a) - value(b));
}

function StatCell({ value, label, className = "text-[#101828]" }: { value: string; label: string; className?: string }) {
  return (
    <div className="min-w-[56px] text-right">
      <p className={`text-sm font-semibold ${className}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#98A2B3]">{label}</p>
    </div>
  );
}

/** Gasto, leads, custo por lead (com a situação frente às metas), CTR e frequência. */
function Metrics({ totals, goals, compact = false }: { totals: LevelTotals; goals: Goals; compact?: boolean }) {
  const cpl = cplCents(totals);
  const level = cplLevel(totals, goals.goodCents, goals.maxCents);
  const c = ctr(totals);
  const f = frequency(totals);
  return (
    <div className={`flex flex-wrap items-center justify-end ${compact ? "gap-3" : "gap-4"}`}>
      <StatCell value={formatCents(totals.spendCents)} label="gasto" />
      <StatCell value={totals.leads.toLocaleString("pt-BR")} label="leads" />
      <div className="min-w-[72px] text-right" title={level !== "none" ? `Custo por lead ${CPL_LEVEL_LABEL[level]}` : undefined}>
        <p className={`text-sm font-semibold ${CPL_TEXT[level]}`}>
          {level !== "none" && <span aria-hidden className="mr-1 text-[9px]">{CPL_ICON[level]}</span>}
          {cpl === null ? "—" : formatCents(cpl)}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-[#98A2B3]">{level !== "none" ? `CPL · ${CPL_LEVEL_LABEL[level]}` : "CPL"}</p>
      </div>
      <StatCell value={c === null ? "—" : `${(c * 100).toFixed(2)}%`} label="CTR" />
      {!compact && <StatCell value={f === null ? "—" : f.toFixed(2)} label="frequência" />}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const label = META_STATUS_LABEL[status] ?? status.toLowerCase();
  const cls = status === "ACTIVE" ? "bg-[#ECFDF3] text-[#027A48]" : status === "DISAPPROVED" || status === "WITH_ISSUES" ? "bg-[#FEF3F2] text-[#B42318]" : status === "PENDING_REVIEW" || status === "IN_PROCESS" ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[#F2F4F7] text-[#667085]";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

async function deleteResource(url: string, router: ReturnType<typeof useRouter>) {
  await fetch(url, { method: "DELETE" });
  router.refresh();
}

function AdItem({ campaignId, adSetId, ad, goals, canManage }: { campaignId: string; adSetId: string; ad: AdRow; goals: Goals; canManage: boolean }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F2F4F7] bg-[#FAFAFB] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {ad.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-[#101828]">{ad.name}</p>
            {ad.synced ? <StatusBadge status={ad.metaStatus} /> : !ad.active && <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-medium text-[#667085]">Pausado</span>}
          </div>
          {ad.metaStatus === "DISAPPROVED" && ad.reviewFeedback && <p className="text-xs text-[#B42318]">Motivo: {ad.reviewFeedback}</p>}
          {ad.creativeNote && <p className="truncate text-xs text-[#98A2B3]">{ad.creativeNote}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {ad.synced && <Metrics totals={ad.totals} goals={goals} compact />}
        {ad.synced && canManage && <TrafficActions level="ad" id={ad.id} name={ad.name} active={isOn(ad.metaStatus)} budgetCents={null} />}
        {ad.assetUrl && (
          <a href={ad.assetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-[#FF2B00] hover:underline">
            Ver peça <ExternalLink size={12} aria-hidden />
          </a>
        )}
        {!ad.synced && (
          <button type="button" aria-label={`Remover anúncio ${ad.name}`} onClick={() => void deleteResource(`/api/campaigns/${campaignId}/ad-sets/${adSetId}/ads/${ad.id}`, router)} className="text-[#98A2B3] hover:text-[#D94343]">
            <Trash2 size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function AdSetBlock({ campaignId, adSet, goals, sort, canManage }: { campaignId: string; adSet: AdSetRow; goals: Goals; sort: SortKey; canManage: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [addingAd, setAddingAd] = useState(false);

  return (
    <div className="rounded-xl border border-[#EEF0F3] bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
          {expanded ? <ChevronDown size={14} className="shrink-0 text-[#98A2B3]" aria-hidden /> : <ChevronRight size={14} className="shrink-0 text-[#98A2B3]" aria-hidden />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[#101828]">{adSet.name}</span>
              {adSet.synced ? <StatusBadge status={adSet.metaStatus} /> : !adSet.active && <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-medium text-[#667085]">Pausado</span>}
              {adSet.budgetCents !== null && <span className="text-xs text-[#667085]">{formatCents(adSet.budgetCents)}/dia</span>}
            </div>
            {adSet.targetingSummary && <p className="truncate text-xs text-[#98A2B3]">{adSet.targetingSummary}</p>}
          </div>
        </button>
        {adSet.synced && <Metrics totals={adSet.totals} goals={goals} compact />}
        {adSet.synced && canManage && <TrafficActions level="adset" id={adSet.id} name={adSet.name} active={isOn(adSet.metaStatus)} budgetCents={adSet.budgetCents} />}
        {!adSet.synced && (
          <>
            <button type="button" onClick={() => setAddingAd(true)} className="flex items-center gap-1 rounded-full border border-[#E4E7EC] px-2 py-1 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB]">
              <Plus size={12} aria-hidden /> Anúncio
            </button>
            <button type="button" aria-label={`Remover conjunto ${adSet.name}`} onClick={() => void deleteResource(`/api/campaigns/${campaignId}/ad-sets/${adSet.id}`, router)} className="text-[#98A2B3] hover:text-[#D94343]">
              <Trash2 size={14} aria-hidden />
            </button>
          </>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col gap-1.5 border-t border-[#F2F4F7] px-3 py-2.5 pl-8">
          {adSet.ads.length === 0 ? (
            <p className="text-xs text-[#98A2B3]">Nenhum anúncio ainda.</p>
          ) : (
            sortRows(adSet.ads, sort).map((ad) => <AdItem key={ad.id} campaignId={campaignId} adSetId={adSet.id} ad={ad} goals={goals} canManage={canManage} />)
          )}
        </div>
      )}
      <AddAdModal campaignId={campaignId} adSetId={adSet.id} open={addingAd} onClose={() => setAddingAd(false)} />
    </div>
  );
}

function CampaignBlock({ row, goals, sort, canManage }: { row: CampaignRow; goals: Goals; sort: SortKey; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [addingAdSet, setAddingAdSet] = useState(false);
  const [addingGeoTarget, setAddingGeoTarget] = useState(false);

  return (
    <div className="rounded-2xl border border-[#E4E7EC] bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
          {expanded ? <ChevronDown size={16} className="shrink-0 text-[#98A2B3]" aria-hidden /> : <ChevronRight size={16} className="shrink-0 text-[#98A2B3]" aria-hidden />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-[#101828]">{row.name}</span>
              <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-medium text-[#475467]">{row.channel}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${row.statusBadgeClass}`}>{row.statusLabel}</span>
            </div>
            <p className="text-xs text-[#98A2B3]">
              {row.clientName ?? "Funil próprio da agência"} · {row.adSets.length} conjunto(s)
              {row.budgetCents !== null && row.synced ? ` · orçamento da campanha ${formatCents(row.budgetCents)}/dia` : ""}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-4">
          <Metrics totals={row.totals} goals={goals} />
          {row.roas !== null && <StatCell value={`${row.roas.toFixed(2)}x`} label="ROAS" />}
          {row.synced && canManage && row.status !== "ENCERRADA" && <TrafficActions level="campaign" id={row.id} name={row.name} active={row.status === "ATIVA"} budgetCents={row.budgetCents} />}
        </div>
      </div>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-[#F2F4F7] px-4 py-3.5 pl-10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Conjuntos de anúncios</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddingGeoTarget(true)} className="flex items-center gap-1 rounded-full border border-[#E4E7EC] px-2.5 py-1 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB]">
                <Plus size={12} aria-hidden /> Ponto no mapa
              </button>
              {row.channel !== "Meta Ads" && (
                <button type="button" onClick={() => setAddingAdSet(true)} className="flex items-center gap-1 rounded-full border border-[#E4E7EC] px-2.5 py-1 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB]">
                  <Plus size={12} aria-hidden /> Conjunto de anúncios
                </button>
              )}
            </div>
          </div>
          {row.adSets.length === 0 ? (
            <p className="text-xs text-[#98A2B3]">Nenhum conjunto de anúncios ainda.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sortRows(row.adSets, sort).map((adSet) => (
                <AdSetBlock key={adSet.id} campaignId={row.id} adSet={adSet} goals={goals} sort={sort} canManage={canManage} />
              ))}
            </div>
          )}
        </div>
      )}
      <AddAdSetModal campaignId={row.id} open={addingAdSet} onClose={() => setAddingAdSet(false)} />
      <AddGeoTargetModal campaignId={row.id} open={addingGeoTarget} onClose={() => setAddingGeoTarget(false)} />
    </div>
  );
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "spend", label: "Maior gasto" },
  { key: "leads", label: "Mais leads" },
  { key: "cpl", label: "Menor custo por lead" },
];

export function CampaignXrayTree({ rows, goals, canManage }: { rows: CampaignRow[]; goals: Goals; canManage: boolean }) {
  const [sort, setSort] = useState<SortKey>("spend");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-[#667085]">
          Ordenar:
          {SORTS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSort(s.key)} className={`rounded-full px-3 py-1 text-xs font-medium ${sort === s.key ? "bg-[#101828] text-white" : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"}`}>
              {s.label}
            </button>
          ))}
        </div>
        {!goals.goodCents && !goals.maxCents && (
          <a href="/trafego-raio-x/gestor?aba=configuracoes" className="text-xs font-medium text-[#FF2B00] hover:underline">
            Defina as metas de custo por lead para ver bom / atenção / acima do máximo
          </a>
        )}
      </div>
      {sortRows(rows, sort).map((row) => (
        <CampaignBlock key={row.id} row={row} goals={goals} sort={sort} canManage={canManage} />
      ))}
    </div>
  );
}
