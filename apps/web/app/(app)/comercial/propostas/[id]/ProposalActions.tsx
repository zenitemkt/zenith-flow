"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProposalStatus } from "@zenite-mkt/db";

export function ProposalActions({ proposalId, status }: { proposalId: string; status: ProposalStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, key: string) {
    setError(null);
    setLoading(key);
    const response = await fetch(`/api/proposals/${proposalId}/${path}`, { method: "POST" });
    setLoading(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível concluir a ação.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status === "RASCUNHO" && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void call("send", "send")}
            className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF2B00" }}
          >
            {loading === "send" ? "Enviando..." : "Enviar"}
          </button>
        )}
        {(status === "ENVIADA" || status === "VISUALIZADA") && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void call("expire", "expire")}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {loading === "expire" ? "Expirando..." : "Marcar como expirada"}
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
