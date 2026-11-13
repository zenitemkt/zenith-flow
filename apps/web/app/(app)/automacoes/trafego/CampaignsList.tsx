"use client";

import { confirmDialog, alertDialog } from "@/lib/dialogs";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  name: string;
  status: "DRAFT" | "SUBMITTING" | "SUBMITTED" | "FAILED";
  metaCampaignId: string | null;
  lastError: string | null;
  createdAt: string;
  submittedAt: string | null;
  adsets: number;
  ads: number;
  dailyBudget: number;
}

const STATUS = {
  DRAFT: { label: "Rascunho", cls: "bg-[#F2F4F7] text-[#344054]" },
  SUBMITTING: { label: "Subindo (incompleta)", cls: "bg-[#EFF8FF] text-[#175CD3]" },
  SUBMITTED: { label: "Na Meta, campanha pausada", cls: "bg-[#ECFDF3] text-[#027A48]" },
  FAILED: { label: "Falhou ao subir", cls: "bg-[#FEF3F2] text-[#B42318]" },
} as const;

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Campanhas montadas no gestor. Métricas e botões de pausar/ativar entram na próxima etapa. */
export function CampaignsList({ campaigns, adAccountId }: { campaigns: Row[]; adAccountId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    if (!await confirmDialog("Apagar este rascunho?", { danger: true })) return;
    setBusy(id);
    const response = await fetch(`/api/traffic/campaigns/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!response.ok) void alertDialog((await response.json().catch(() => null))?.error ?? "Não consegui apagar.");
    router.refresh();
  }

  if (!campaigns.length) {
    return (
      <p className="rounded-xl border border-dashed border-[#D0D5DD] bg-white p-10 text-center text-sm text-[#667085]">
        Nenhuma campanha ainda. <Link href="/automacoes/trafego?aba=nova" className="font-semibold text-[#FF2B00]">Montar a primeira</Link>
      </p>
    );
  }

  const act = adAccountId?.replace(/^act_/, "");
  return (
    <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <ul className="divide-y divide-[#EEF0F3]">
        {campaigns.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#101828]">{c.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
              </div>
              <p className="text-xs text-[#667085]">
                {c.adsets} conjunto(s) · {c.ads} anúncio(s) · R$ {c.dailyBudget.toFixed(2)}/dia · criada {fmt(c.createdAt)}
                {c.submittedAt ? ` · enviada ${fmt(c.submittedAt)}` : ""}
              </p>
              {c.lastError && c.status !== "SUBMITTED" && <p className="mt-1 break-words text-xs text-[#B42318]">{c.lastError}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              {c.status !== "SUBMITTED" && (
                <Link href={`/automacoes/trafego?aba=nova&campanha=${c.id}`} className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-medium text-white">
                  {c.status === "DRAFT" ? "Continuar" : "Revisar e tentar de novo"}
                </Link>
              )}
              {c.metaCampaignId && act && (
                <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}&selected_campaign_ids=${c.metaCampaignId}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054]">
                  Abrir no Gerenciador
                </a>
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
  );
}
