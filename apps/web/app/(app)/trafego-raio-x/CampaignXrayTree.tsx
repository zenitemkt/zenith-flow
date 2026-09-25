"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, Plus, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/finance";
import type { CampaignTotals } from "@/lib/campaign-xray";
import { AddAdSetModal } from "./AddAdSetModal";
import { AddAdModal } from "./AddAdModal";
import { AddGeoTargetModal } from "./AddGeoTargetModal";

interface AdRow {
  id: string;
  name: string;
  creativeNote: string | null;
  assetUrl: string | null;
  active: boolean;
}

interface AdSetRow {
  id: string;
  name: string;
  budgetCents: number | null;
  targetingSummary: string | null;
  active: boolean;
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
  totals: CampaignTotals;
  adSets: AdSetRow[];
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right">
      <p className="text-sm font-semibold text-[#101828]">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#98A2B3]">{label}</p>
    </div>
  );
}

async function deleteResource(url: string, router: ReturnType<typeof useRouter>) {
  await fetch(url, { method: "DELETE" });
  router.refresh();
}

function AdItem({ campaignId, adSetId, ad }: { campaignId: string; adSetId: string; ad: AdRow }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#F2F4F7] bg-[#FAFAFB] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#101828]">{ad.name}</p>
        {ad.creativeNote && <p className="truncate text-xs text-[#98A2B3]">{ad.creativeNote}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {ad.assetUrl && (
          <a
            href={ad.assetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-[#FF2B00] hover:underline"
          >
            Ver peça <ExternalLink size={12} aria-hidden />
          </a>
        )}
        <button
          type="button"
          aria-label={`Remover anúncio ${ad.name}`}
          onClick={() => void deleteResource(`/api/campaigns/${campaignId}/ad-sets/${adSetId}/ads/${ad.id}`, router)}
          className="text-[#98A2B3] hover:text-[#D94343]"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function AdSetBlock({ campaignId, adSet }: { campaignId: string; adSet: AdSetRow }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [addingAd, setAddingAd] = useState(false);

  return (
    <div className="rounded-xl border border-[#EEF0F3] bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={14} className="text-[#98A2B3]" aria-hidden /> : <ChevronRight size={14} className="text-[#98A2B3]" aria-hidden />}
          <span className="text-sm font-medium text-[#101828]">{adSet.name}</span>
          {!adSet.active && <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-medium text-[#667085]">Pausado</span>}
          {adSet.targetingSummary && <span className="truncate text-xs text-[#98A2B3]">· {adSet.targetingSummary}</span>}
        </button>
        {adSet.budgetCents !== null && <span className="text-xs text-[#667085]">{formatCents(adSet.budgetCents)}</span>}
        <button
          type="button"
          onClick={() => setAddingAd(true)}
          className="flex items-center gap-1 rounded-full border border-[#E4E7EC] px-2 py-1 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB]"
        >
          <Plus size={12} aria-hidden /> Anúncio
        </button>
        <button
          type="button"
          aria-label={`Remover conjunto ${adSet.name}`}
          onClick={() => void deleteResource(`/api/campaigns/${campaignId}/ad-sets/${adSet.id}`, router)}
          className="text-[#98A2B3] hover:text-[#D94343]"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-1.5 border-t border-[#F2F4F7] px-3 py-2.5 pl-8">
          {adSet.ads.length === 0 ? (
            <p className="text-xs text-[#98A2B3]">Nenhum anúncio cadastrado ainda.</p>
          ) : (
            adSet.ads.map((ad) => <AdItem key={ad.id} campaignId={campaignId} adSetId={adSet.id} ad={ad} />)
          )}
        </div>
      )}
      <AddAdModal campaignId={campaignId} adSetId={adSet.id} open={addingAd} onClose={() => setAddingAd(false)} />
    </div>
  );
}

function CampaignBlock({ row }: { row: CampaignRow }) {
  const [expanded, setExpanded] = useState(false);
  const [addingAdSet, setAddingAdSet] = useState(false);
  const [addingGeoTarget, setAddingGeoTarget] = useState(false);

  return (
    <div className="rounded-2xl border border-[#E4E7EC] bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={16} className="text-[#98A2B3]" aria-hidden /> : <ChevronRight size={16} className="text-[#98A2B3]" aria-hidden />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-[#101828]">{row.name}</span>
              <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-medium text-[#475467]">{row.channel}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${row.statusBadgeClass}`}>{row.statusLabel}</span>
            </div>
            <p className="text-xs text-[#98A2B3]">{row.clientName ?? "Funil próprio da agência"}</p>
          </div>
        </button>
        <div className="flex items-center gap-4">
          <StatCell value={formatCents(row.totals.spendCents)} label="gasto" />
          <StatCell value={row.totals.clicks.toLocaleString("pt-BR")} label="cliques" />
          <StatCell value={row.totals.frequency === null ? "—" : row.totals.frequency.toFixed(2)} label="frequência" />
          <StatCell value={row.totals.roi === null ? "—" : `${Math.round(row.totals.roi * 100)}%`} label="ROI" />
          <StatCell value={row.totals.roas === null ? "—" : `${row.totals.roas.toFixed(2)}x`} label="ROAS" />
        </div>
      </div>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-[#F2F4F7] px-4 py-3.5 pl-10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Conjuntos de anúncios</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddingGeoTarget(true)}
                className="flex items-center gap-1 rounded-full border border-[#E4E7EC] px-2.5 py-1 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB]"
              >
                <Plus size={12} aria-hidden /> Ponto no mapa
              </button>
              <button
                type="button"
                onClick={() => setAddingAdSet(true)}
                className="flex items-center gap-1 rounded-full border border-[#E4E7EC] px-2.5 py-1 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB]"
              >
                <Plus size={12} aria-hidden /> Conjunto de anúncios
              </button>
            </div>
          </div>
          {row.adSets.length === 0 ? (
            <p className="text-xs text-[#98A2B3]">Nenhum conjunto de anúncios cadastrado ainda.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {row.adSets.map((adSet) => (
                <AdSetBlock key={adSet.id} campaignId={row.id} adSet={adSet} />
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

export function CampaignXrayTree({ rows }: { rows: CampaignRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <CampaignBlock key={row.id} row={row} />
      ))}
    </div>
  );
}
