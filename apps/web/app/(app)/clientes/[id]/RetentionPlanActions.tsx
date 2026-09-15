"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetentionPlanActions({ planId }: { planId: string }) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<"CONCLUIDO" | "CANCELADO" | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(toStatus: "CONCLUIDO" | "CANCELADO", resultValue: string) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/retention-plans/${planId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, result: resultValue }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível atualizar o plano.");
      return;
    }
    setPendingTarget(null);
    setResult("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => setPendingTarget("CONCLUIDO")}
          className="flex h-8 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
        >
          Concluir
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void submit("CANCELADO", "")}
          className="flex h-8 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
        >
          Cancelar plano
        </button>
      </div>

      {pendingTarget === "CONCLUIDO" && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-3">
          <input
            autoFocus
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="Resultado do plano (obrigatório para concluir)"
            className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !result.trim()}
              onClick={() => void submit("CONCLUIDO", result.trim())}
              className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setPendingTarget(null)}
              className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-white"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
