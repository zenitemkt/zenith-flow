"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function PortalApprovalActions({ contentItemId }: { contentItemId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"AJUSTES_SOLICITADOS" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitDecision(finalDecision: "APROVADO" | "AJUSTES_SOLICITADOS", finalNote: string) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/portal/content/${contentItemId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: finalDecision, note: finalNote || undefined }),
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível registrar sua decisão.");
      return;
    }
    router.refresh();
  }

  function handleAdjustSubmit(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    void submitDecision("AJUSTES_SOLICITADOS", note.trim());
  }

  if (decision === "AJUSTES_SOLICITADOS") {
    return (
      <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-2">
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          required
          placeholder="O que precisa mudar?"
          className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
        />
        {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDecision(null)}
            className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={loading || !note.trim()}
            className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#6847F5" }}
          >
            {loading ? "Enviando..." : "Enviar pedido"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void submitDecision("APROVADO", "")}
          className="flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#16A36A" }}
        >
          Aprovar
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setDecision("AJUSTES_SOLICITADOS")}
          className="flex h-9 flex-1 items-center justify-center rounded-lg border border-[#D0D5DD] text-sm font-semibold text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
        >
          Pedir ajuste
        </button>
      </div>
    </div>
  );
}
