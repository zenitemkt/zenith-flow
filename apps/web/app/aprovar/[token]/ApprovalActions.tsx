"use client";

import { useState, type FormEvent } from "react";

export function ApprovalActions({ token }: { token: string }) {
  const [decision, setDecision] = useState<"APROVADO" | "AJUSTES_SOLICITADOS" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"APROVADO" | "AJUSTES" | null>(null);

  async function submitDecision(finalDecision: "APROVADO" | "AJUSTES_SOLICITADOS", finalNote: string) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/approvals/${token}`, {
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
    setDone(body.status);
  }

  function handleAdjustSubmit(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    void submitDecision("AJUSTES_SOLICITADOS", note.trim());
  }

  if (done === "APROVADO") {
    return (
      <div className="rounded-lg bg-[#DCFCE7] p-4 text-center text-sm font-medium text-[#166534]">
        Aprovado! Obrigado — a agência já foi avisada.
      </div>
    );
  }
  if (done === "AJUSTES") {
    return (
      <div className="rounded-lg bg-[#FEF3C7] p-4 text-center text-sm font-medium text-[#92600A]">
        Pedido de ajuste enviado — a agência vai revisar e mandar uma nova versão.
      </div>
    );
  }

  if (decision === "AJUSTES_SOLICITADOS") {
    return (
      <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-2">
        <label htmlFor="adjust-note" className="text-sm font-medium text-[#344054]">
          O que precisa mudar?
        </label>
        <textarea
          id="adjust-note"
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
        />
        {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDecision(null)}
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={loading || !note.trim()}
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#6847F5" }}
          >
            {loading ? "Enviando..." : "Enviar pedido de ajuste"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      <button
        type="button"
        disabled={loading}
        onClick={() => void submitDecision("APROVADO", "")}
        className="flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#16A36A" }}
      >
        Aprovar
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => setDecision("AJUSTES_SOLICITADOS")}
        className="flex h-11 items-center justify-center rounded-lg border border-[#D0D5DD] text-sm font-semibold text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
      >
        Solicitar ajuste
      </button>
    </div>
  );
}
