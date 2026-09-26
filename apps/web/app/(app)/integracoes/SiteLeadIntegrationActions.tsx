"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  enabled: boolean;
  configured: boolean;
  canManage: boolean;
};

export function SiteLeadIntegrationActions({ enabled, configured, canManage }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(nextEnabled: boolean) {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/integrations/site-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setConfirming(false);
    if (!response.ok) {
      setError(result.error || "Não foi possível atualizar a integração.");
      return;
    }
    router.refresh();
  }

  if (!canManage) return null;

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="max-w-xs text-right text-xs text-[#B42318]">
          Novos formulários deixarão de entrar no CRM. Os leads existentes serão preservados.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={loading} onClick={() => void update(false)} className="rounded-lg bg-[#D94343] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {loading ? "Desconectando..." : "Confirmar desconexão"}
          </button>
          <button type="button" disabled={loading} onClick={() => setConfirming(false)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054]">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {enabled ? (
        <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-[#FDA29B] px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2]">
          Desconectar
        </button>
      ) : (
        <button type="button" disabled={loading || !configured} onClick={() => void update(true)} className="rounded-lg bg-[#FF3D00] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Conectando..." : "Reconectar"}
        </button>
      )}
      {error && <p className="max-w-xs text-right text-xs text-[#B42318]">{error}</p>}
    </div>
  );
}