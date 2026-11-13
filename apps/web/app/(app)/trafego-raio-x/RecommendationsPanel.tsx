"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";
import { confirmDialog } from "@/lib/dialogs";
import { formatCents } from "@/lib/finance";

export interface RecommendationItem {
  id: string;
  type: string;
  level: string;
  targetName: string;
  campaignName: string | null;
  reason: string;
  suggestedBudgetCents: number | null;
  createdAt: string;
}

const TYPE: Record<string, { label: string; icon: string; cls: string; action: string | null }> = {
  PAUSE: { label: "Pausar", icon: "■", cls: "bg-[#FEF3F2] text-[#B42318]", action: "Pausar agora" },
  DECREASE_BUDGET: { label: "Reduzir verba", icon: "▼", cls: "bg-[#FFFAEB] text-[#B54708]", action: "Reduzir verba" },
  INCREASE_BUDGET: { label: "Aumentar verba", icon: "▲", cls: "bg-[#ECFDF3] text-[#027A48]", action: "Aumentar verba" },
  CREATIVE_FATIGUE: { label: "Criativo cansado", icon: "◆", cls: "bg-[#FFFAEB] text-[#B54708]", action: null },
  REJECTED: { label: "Reprovado", icon: "■", cls: "bg-[#FEF3F2] text-[#B42318]", action: null },
};
const LEVEL: Record<string, string> = { campaign: "Campanha", adset: "Conjunto", ad: "Anúncio" };

/** Recomendações do dia: cada uma com o motivo, os números e Aplicar / Ignorar. */
export function RecommendationsPanel({ items, canManage }: { items: RecommendationItem[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(item: RecommendationItem, decision: "apply" | "ignore" | "done") {
    const meta = TYPE[item.type];
    if (decision === "apply") {
      const ok = await confirmDialog(`${meta?.action ?? "Aplicar"}: ${LEVEL[item.level]?.toLowerCase() ?? ""} "${item.targetName}"${item.suggestedBudgetCents ? ` para ${formatCents(item.suggestedBudgetCents)}/dia` : ""}?`, { title: "Aplicar recomendação", confirmLabel: meta?.action ?? "Aplicar", danger: item.type === "PAUSE" });
      if (!ok) return;
    }
    setBusy(item.id);
    try {
      const res = await fetch(`/api/traffic/recommendations/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Não consegui aplicar.");
        return;
      }
      toast.success(decision === "apply" ? `Feito: ${data.note ?? "aplicado"}.` : decision === "done" ? "Marcada como resolvida." : "Ignorada por 7 dias.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#FF2B00]/30 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#101828]">Recomendações de hoje ({items.length})</h2>
        <p className="text-xs text-[#98A2B3]">Últimos 7 dias, pelas metas de custo por lead. Nada é aplicado sem você.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const meta = TYPE[item.type] ?? { label: item.type, icon: "•", cls: "bg-[#F2F4F7] text-[#475467]", action: null };
          return (
            <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-[#EEF0F3] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                    <span aria-hidden className="mr-1">{meta.icon}</span>
                    {meta.label}
                  </span>
                  <span className="text-sm font-medium text-[#101828]">
                    {LEVEL[item.level] ?? item.level}: {item.targetName}
                  </span>
                  {item.campaignName && item.campaignName !== item.targetName && <span className="text-xs text-[#98A2B3]">em {item.campaignName}</span>}
                </div>
                <p className="mt-1 text-xs text-[#475467]">{item.reason}</p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-2">
                  {meta.action ? (
                    <button type="button" disabled={busy === item.id} onClick={() => void decide(item, "apply")} className="rounded-lg bg-[#FF2B00] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {meta.action}
                    </button>
                  ) : (
                    <button type="button" disabled={busy === item.id} onClick={() => void decide(item, "done")} className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {item.type === "REJECTED" ? "Já corrigi" : "Já troquei"}
                    </button>
                  )}
                  <button type="button" disabled={busy === item.id} onClick={() => void decide(item, "ignore")} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054] disabled:opacity-50">
                    Ignorar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
