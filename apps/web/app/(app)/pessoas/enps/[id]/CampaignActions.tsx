"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EnpsCampaignStatus } from "@zenite-mkt/db";

export function CampaignActions({ campaignId, status }: { campaignId: string; status: EnpsCampaignStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, key: string) {
    setError(null);
    setLoading(key);
    const response = await fetch(`/api/enps/campaigns/${campaignId}/${path}`, { method: "POST" });
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
        {status === "ENVIADA" && (
          <>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void call("recalculate", "recalculate")}
              className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
            >
              {loading === "recalculate" ? "Calculando..." : "Recalcular eNPS"}
            </button>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void call("close", "close")}
              className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
            >
              {loading === "close" ? "Encerrando..." : "Encerrar"}
            </button>
          </>
        )}
        {status === "ENCERRADA" && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void call("recalculate", "recalculate")}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {loading === "recalculate" ? "Calculando..." : "Recalcular eNPS"}
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
