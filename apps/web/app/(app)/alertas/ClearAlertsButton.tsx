"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Marca como resolvidos todos os alertas abertos (ou só os da categoria filtrada). */
export function ClearAlertsButton({ category, count }: { category?: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    await fetch("/api/system-alerts/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category ? { categories: [category] } : {}),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy || count === 0}
      onClick={clear}
      className="ml-auto rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
      title="Marca os alertas abertos como resolvidos. Se o problema continuar, a próxima checagem reabre o alerta."
    >
      {busy ? "Limpando…" : category ? `Limpar abertos desta categoria (${count})` : `Limpar todos os abertos (${count})`}
    </button>
  );
}
