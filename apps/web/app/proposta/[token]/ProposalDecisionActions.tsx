"use client";

import { useState, type FormEvent } from "react";

export function ProposalDecisionActions({ token }: { token: string }) {
  const [decision, setDecision] = useState<"REJEITADA" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"ACEITA" | "REJEITADA" | null>(null);

  async function submit(finalDecision: "ACEITA" | "REJEITADA", finalReason: string | null) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/public/proposals/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: finalDecision, reason: finalReason || undefined }),
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível registrar sua decisão.");
      return;
    }
    setDone(body.status);
  }

  function handleRejectSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    void submit("REJEITADA", reason.trim());
  }

  if (done === "ACEITA") {
    return (
      <div className="rounded-lg bg-[#DCFCE7] p-4 text-center text-sm font-medium text-[#166534]">
        Proposta aceita! A agência já foi avisada.
      </div>
    );
  }
  if (done === "REJEITADA") {
    return (
      <div className="rounded-lg bg-[#FEE4E2] p-4 text-center text-sm font-medium text-[#B42318]">
        Recusa registrada — obrigado pelo retorno.
      </div>
    );
  }

  if (decision === "REJEITADA") {
    return (
      <form onSubmit={handleRejectSubmit} className="flex flex-col gap-2">
        <label htmlFor="reject-reason" className="text-sm font-medium text-[#344054]">
          O que motivou a recusa?
        </label>
        <textarea
          id="reject-reason"
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
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
            disabled={loading || !reason.trim()}
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#D94343" }}
          >
            {loading ? "Enviando..." : "Confirmar recusa"}
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
        onClick={() => void submit("ACEITA", null)}
        className="flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#16A36A" }}
      >
        Aceitar proposta
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => setDecision("REJEITADA")}
        className="flex h-11 items-center justify-center rounded-lg border border-[#D0D5DD] text-sm font-semibold text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
      >
        Recusar
      </button>
    </div>
  );
}
