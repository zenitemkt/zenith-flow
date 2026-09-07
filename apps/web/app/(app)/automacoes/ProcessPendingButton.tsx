"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Sem worker/cron real (ver docs/DECISIONS.md) — avança manualmente as execuções em ESPERA que já venceram. */
export function ProcessPendingButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function process() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/workflow-runs/process-pending", { method: "POST" });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Não foi possível processar.");
      return;
    }
    setMessage(body.processed === 0 ? "Nada pendente agora." : `${body.processed} execução(ões) avançada(s).`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-[#667085]">{message}</span>}
      <button
        type="button"
        disabled={loading}
        onClick={() => void process()}
        className="flex h-10 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-60"
      >
        {loading ? "Processando..." : "Processar automações pendentes"}
      </button>
    </div>
  );
}
