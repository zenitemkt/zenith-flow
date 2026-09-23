"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EnpsCampaignStatus } from "@zenite-mkt/db";

export function CampaignActions({
  campaignId,
  status,
  pendingCount,
  emailConfigured,
}: {
  campaignId: string;
  status: EnpsCampaignStatus;
  pendingCount: number;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function call(path: string, key: string) {
    if (key === "send") {
      const n = pendingCount;
      const who = `${n} convidado${n === 1 ? "" : "s"} pendente${n === 1 ? "" : "s"}`;
      const confirmed = window.confirm(
        emailConfigured
          ? `Isso vai mandar e-mail de verdade pra ${who}. Confirma?`
          : `Isso vai marcar ${who} como enviado (sem e-mail real — Resend não configurado). Confirma?`,
      );
      if (!confirmed) return;
    }
    setError(null);
    setResult(null);
    setLoading(key);
    const response = await fetch(`/api/enps/campaigns/${campaignId}/${path}`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setLoading(null);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível concluir a ação.");
      return;
    }
    if (key === "send" && typeof body?.sent === "number") {
      setResult(
        body.failed > 0
          ? `Enviado (${body.sent}), falhou (${body.failed})`
          : `Enviado (${body.sent})`,
      );
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
      {result && <p className="text-xs font-medium text-[#166534]">{result}</p>}
    </div>
  );
}
