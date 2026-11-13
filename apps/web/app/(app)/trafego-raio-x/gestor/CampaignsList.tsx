"use client";

import { confirmDialog, alertDialog } from "@/lib/dialogs";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DraftRow {
  id: string;
  name: string;
  status: "DRAFT" | "SUBMITTING" | "SUBMITTED" | "FAILED";
  mode: "NEW" | "ADD_ADSETS" | "ADD_ADS";
  targetLabel: string | null;
  metaCampaignId: string | null;
  lastError: string | null;
  createdAt: string;
  submittedAt: string | null;
  adsets: number;
  ads: number;
  dailyBudget: number;
}

interface MetaCampaignRow {
  metaCampaignId: string;
  name: string;
  status: string;
  budgetCents: number | null;
  fromPortal: boolean;
  adsets: { metaAdSetId: string; name: string; ads: number }[];
}

const STATUS = {
  DRAFT: { label: "Rascunho", cls: "bg-[#F2F4F7] text-[#344054]" },
  SUBMITTING: { label: "Subindo (incompleta)", cls: "bg-[#EFF8FF] text-[#175CD3]" },
  SUBMITTED: { label: "Na Meta", cls: "bg-[#ECFDF3] text-[#027A48]" },
  FAILED: { label: "Falhou ao subir", cls: "bg-[#FEF3F2] text-[#B42318]" },
} as const;
const META_STATUS: Record<string, { label: string; cls: string }> = {
  ATIVA: { label: "Ativa", cls: "bg-[#ECFDF3] text-[#027A48]" },
  PAUSADA: { label: "Pausada", cls: "bg-[#FFFAEB] text-[#B54708]" },
};

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Rascunhos do gestor e campanhas da Meta, com inclusão de conjuntos e criativos em cada uma. */
export function CampaignsList({ drafts, metaCampaigns, adAccountId }: { drafts: DraftRow[]; metaCampaigns: MetaCampaignRow[]; adAccountId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const act = adAccountId?.replace(/^act_/, "");

  async function remove(id: string) {
    if (!(await confirmDialog("Apagar este rascunho?", { danger: true }))) return;
    setBusy(id);
    const response = await fetch(`/api/traffic/campaigns/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!response.ok) void alertDialog((await response.json().catch(() => null))?.error ?? "Não consegui apagar.");
    router.refresh();
  }

  async function extend(mode: "ADD_ADSETS" | "ADD_ADS", metaCampaignId: string, metaAdSetId?: string) {
    setBusy(metaAdSetId ?? metaCampaignId);
    const res = await fetch("/api/traffic/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, metaCampaignId, metaAdSetId }) });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok || !data?.id) {
      void alertDialog(data?.error ?? "Não consegui preparar a inclusão.");
      return;
    }
    router.push(`/trafego-raio-x/gestor?aba=nova&campanha=${data.id}`);
  }

  if (!drafts.length && !metaCampaigns.length) {
    return (
      <p className="rounded-xl border border-dashed border-[#D0D5DD] bg-white p-10 text-center text-sm text-[#667085]">
        Nenhuma campanha ainda. <Link href="/trafego-raio-x/gestor?aba=nova" className="font-semibold text-[#FF2B00]">Montar a primeira</Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {drafts.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <p className="border-b border-[#EEF0F3] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Rascunhos e envios</p>
          <ul className="divide-y divide-[#EEF0F3]">
            {drafts.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#101828]">{c.mode === "NEW" ? c.name : c.targetLabel}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                    {c.mode !== "NEW" && <span className="rounded-full bg-[#FFF4ED] px-2 py-0.5 text-xs font-medium text-[#C42100]">{c.mode === "ADD_ADS" ? "Novos anúncios" : "Novos conjuntos"}</span>}
                  </div>
                  <p className="text-xs text-[#667085]">
                    {c.mode !== "ADD_ADS" && `${c.adsets} conjunto(s) · `}
                    {c.ads} criativo(s){c.mode === "NEW" ? ` · R$ ${c.dailyBudget.toFixed(2)}/dia` : ""} · criado {fmt(c.createdAt)}
                    {c.submittedAt ? ` · enviado ${fmt(c.submittedAt)}` : ""}
                  </p>
                  {c.lastError && c.status !== "SUBMITTED" && <p className="mt-1 break-words text-xs text-[#B42318]">{c.lastError}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {c.status !== "SUBMITTED" && (
                    <Link href={`/trafego-raio-x/gestor?aba=nova&campanha=${c.id}`} className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-medium text-white">
                      {c.status === "DRAFT" ? "Continuar" : "Revisar e tentar de novo"}
                    </Link>
                  )}
                  {!c.metaCampaignId && (
                    <button type="button" disabled={busy === c.id} onClick={() => remove(c.id)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#B42318] disabled:opacity-50">
                      Apagar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {metaCampaigns.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <p className="border-b border-[#EEF0F3] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Campanhas na Meta</p>
          <ul className="divide-y divide-[#EEF0F3]">
            {metaCampaigns.map((c) => {
              const status = META_STATUS[c.status] ?? { label: c.status.toLowerCase(), cls: "bg-[#F2F4F7] text-[#667085]" };
              return (
                <li key={c.metaCampaignId} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#101828]">{c.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                        {!c.fromPortal && <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#667085]">Criada no Gerenciador</span>}
                      </div>
                      <p className="text-xs text-[#667085]">
                        {c.adsets.length} conjunto(s) · {c.adsets.reduce((n, a) => n + a.ads, 0)} anúncio(s)
                        {c.budgetCents ? ` · orçamento da campanha R$ ${(c.budgetCents / 100).toFixed(2)}/dia` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" disabled={busy === c.metaCampaignId} onClick={() => void extend("ADD_ADSETS", c.metaCampaignId)} className="rounded-lg bg-[#FF2B00] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                        {busy === c.metaCampaignId ? "Preparando…" : "+ Conjuntos e criativos"}
                      </button>
                      <button type="button" disabled={!c.adsets.length} onClick={() => setPickingFor(pickingFor === c.metaCampaignId ? null : c.metaCampaignId)} className="rounded-lg border border-[#FF2B00] px-3 py-1.5 text-xs font-semibold text-[#FF2B00] disabled:opacity-40" title={c.adsets.length ? undefined : "Atualize da Meta no Raio X para listar os conjuntos"}>
                        + Criativos
                      </button>
                      {act && (
                        <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}&selected_campaign_ids=${c.metaCampaignId}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054]">
                          Abrir no Gerenciador
                        </a>
                      )}
                    </div>
                  </div>
                  {pickingFor === c.metaCampaignId && (
                    <div className="rounded-lg bg-[#F9FAFB] p-3">
                      <p className="mb-2 text-xs font-semibold text-[#344054]">Em qual conjunto entram os criativos novos?</p>
                      <div className="flex flex-col gap-1.5">
                        {c.adsets.map((a) => (
                          <button key={a.metaAdSetId} type="button" disabled={busy === a.metaAdSetId} onClick={() => void extend("ADD_ADS", c.metaCampaignId, a.metaAdSetId)} className="flex items-center justify-between gap-2 rounded-lg border border-[#EEF0F3] bg-white px-3 py-2 text-left text-sm hover:border-[#FF2B00] disabled:opacity-50">
                            <span className="min-w-0 truncate font-mono text-xs text-[#101828]">{a.name}</span>
                            <span className="shrink-0 text-xs text-[#667085]">{busy === a.metaAdSetId ? "Preparando…" : `${a.ads} anúncio(s) · escolher`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
