"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";
import { confirmDialog } from "@/lib/dialogs";

type Level = "campaign" | "adset" | "ad";
const LEVEL_NAME: Record<Level, string> = { campaign: "a campanha", adset: "o conjunto", ad: "o anúncio" };

/**
 * Pausar/ativar e ajustar verba de campanha, conjunto ou anúncio da Meta (só administradores).
 * As travas (teto, variação máxima, botão de emergência) são conferidas no servidor.
 */
export function TrafficActions({ level, id, name, active, budgetCents }: { level: Level; id: string; name: string; active: boolean; budgetCents: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budgetCents ? String(budgetCents / 100) : "");

  async function run(action: "pause" | "activate" | "budget", dailyBudget?: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/traffic/xray-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level, id, action, dailyBudget }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Não consegui alterar na Meta.");
        return;
      }
      toast.success(`Feito: ${data.summary} "${name}".`);
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Erro de rede. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    const action = active ? "pause" : "activate";
    const ok = await confirmDialog(
      active ? `Pausar ${LEVEL_NAME[level]} "${name}"? A veiculação para na hora.` : `Ativar ${LEVEL_NAME[level]} "${name}"? ${level === "campaign" ? "A campanha começa a gastar." : "Volta a veicular se a campanha estiver ativa."}`,
      { title: active ? "Pausar na Meta" : "Ativar na Meta", confirmLabel: active ? "Pausar" : "Ativar", danger: active },
    );
    if (ok) await run(action);
  }

  async function saveBudget() {
    const next = Number(value.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) {
      toast.error("Informe a verba diária em reais.");
      return;
    }
    const ok = await confirmDialog(`Mudar a verba diária de "${name}" de R$ ${((budgetCents ?? 0) / 100).toFixed(2)} para R$ ${next.toFixed(2)}?`, { title: "Ajustar verba na Meta", confirmLabel: "Mudar verba" });
    if (ok) await run("budget", next);
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {budgetCents !== null &&
        (editing ? (
          <span className="flex items-center gap-1">
            <span className="text-xs text-[#667085]">R$</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" autoFocus onKeyDown={(e) => e.key === "Enter" && void saveBudget()} className="w-20 rounded-md border border-[#D0D5DD] bg-white px-2 py-1 text-xs text-[#101828]" aria-label="Nova verba diária" />
            <button type="button" disabled={busy} onClick={() => void saveBudget()} className="rounded-md bg-[#101828] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Salvar</button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-[#667085]">Cancelar</button>
          </span>
        ) : (
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className="rounded-full border border-[#E4E7EC] px-2.5 py-1 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB] disabled:opacity-50">
            Verba
          </button>
        ))}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${active ? "border border-[#FECDCA] text-[#B42318] hover:bg-[#FEF3F2]" : "bg-[#FF2B00] text-white hover:bg-[#E02600]"}`}
      >
        {busy ? "…" : active ? "Pausar" : "Ativar"}
      </button>
    </div>
  );
}
