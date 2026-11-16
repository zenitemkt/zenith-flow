"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alertDialog, confirmDialog } from "@/lib/dialogs";

/** Zera os lançamentos de teste (só admin). */
export function ResetFinanceButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    const ok = await confirmDialog(
      "Apagar TODOS os lançamentos do Financeiro (a receber, a pagar, estornos, divisões entre sócios e repasses pagos)? Categorias, sócios e configurações ficam. Não dá para desfazer.",
      { title: "Zerar lançamentos", confirmLabel: "Zerar tudo", danger: true },
    );
    if (!ok) return;
    setBusy(true);
    const res = await fetch("/api/finance/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "ZERAR" }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      await alertDialog(body?.error ?? "Não foi possível zerar.", { title: "Não zerou" });
      return;
    }
    await alertDialog(`${body.entries} lançamento(s) e ${body.payouts} repasse(s) apagados.`, { title: "Financeiro zerado" });
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={() => void reset()} className="rounded-lg border border-[#FDA29B] bg-white px-3 py-2 text-sm font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60">
      {busy ? "Zerando..." : "Zerar lançamentos"}
    </button>
  );
}
