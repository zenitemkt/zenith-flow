"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

/** Etapa 5 do plano de Traqueamento — puxa campanha+métrica dos últimos 30 dias direto da Meta. */
export function SyncMetaCampaignsButton() {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/integrations/meta/sync-campaigns", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível sincronizar com a Meta.");
        return;
      }
      toast.success(
        `Sincronizado: ${data.campaignsCreated} campanha${data.campaignsCreated === 1 ? "" : "s"} nova${data.campaignsCreated === 1 ? "" : "s"}, ${data.metricsUpserted} dia${data.metricsUpserted === 1 ? "" : "s"} de métrica atualizados.`,
      );
      router.refresh();
    } catch {
      toast.error("Erro de rede — tente novamente.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={sync}
      disabled={syncing}
      className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] hover:border-[#FF2B00] hover:text-[#FF2B00] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {syncing ? "Sincronizando…" : "Atualizar da Meta"}
    </button>
  );
}
