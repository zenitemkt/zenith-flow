"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PublishButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/workflows/${workflowId}/publish`, { method: "POST" });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível publicar.");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#92600A]">Depois de publicar, os passos não podem mais ser editados.</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => void publish()}
            className="rounded-lg bg-[#FF2B00] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Publicando..." : "Confirmar"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054]">
            Cancelar
          </button>
        </div>
        {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white"
      style={{ backgroundColor: "#FF2B00" }}
    >
      Publicar
    </button>
  );
}
