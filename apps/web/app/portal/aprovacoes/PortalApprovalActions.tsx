"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { ghostButtonClass, inputClass, primaryButtonClass, quietButtonClass } from "../_components/ui";

export function PortalApprovalActions({ contentItemId }: { contentItemId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"AJUSTES_SOLICITADOS" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  async function submitDecision(finalDecision: "APROVADO" | "AJUSTES_SOLICITADOS", finalNote: string) {
    await guardSubmit(async () => {
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
        setError(body?.error ?? "Não foi possível registrar sua decisão. Tente de novo.");
        return;
      }
      router.refresh();
    });
  }

  function handleAdjustSubmit(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    void submitDecision("AJUSTES_SOLICITADOS", note.trim());
  }

  if (decision === "AJUSTES_SOLICITADOS") {
    return (
      <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-3">
        <label htmlFor={`adjust-${contentItemId}`} className="text-sm font-medium text-[#D6D3CF]">
          O que precisa mudar?
        </label>
        <textarea
          id={`adjust-${contentItemId}`}
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          placeholder="Ex.: trocar a foto de capa, deixar o texto mais curto…"
          className={`${inputClass} resize-none py-2.5`}
        />
        {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setDecision(null)} className={quietButtonClass}>
            Voltar
          </button>
          <button type="submit" disabled={loading || !note.trim()} className={primaryButtonClass}>
            {loading ? "Enviando…" : "Enviar ajuste"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
        <button
          type="button"
          disabled={loading}
          onClick={() => void submitDecision("APROVADO", "")}
          className={`${primaryButtonClass} h-11 flex-1`}
        >
          {loading ? "Registrando…" : "Aprovar"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setDecision("AJUSTES_SOLICITADOS")}
          className={`${ghostButtonClass} h-11 flex-1`}
        >
          Pedir ajuste
        </button>
      </div>
    </div>
  );
}
