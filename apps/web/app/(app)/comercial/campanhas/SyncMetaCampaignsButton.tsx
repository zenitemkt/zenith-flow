"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Traz da Meta o nome, a situação real (ativa, pausada, encerrada) e as
 * métricas dos últimos 30 dias. Com `autoSync`, roda sozinho uma vez ao abrir
 * a tela (quando a última atualização já está velha), sem aviso se der certo.
 */
export function SyncMetaCampaignsButton({ autoSync = false }: { autoSync?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const autoRan = useRef(false);

  async function sync(silent: boolean) {
    setSyncing(true);
    try {
      const response = await fetch("/api/integrations/meta/sync-campaigns", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível sincronizar com a Meta.");
        return;
      }
      const account = `${data.accountName ?? "conta"} (${data.accountId})`;
      if (data.campaignsFound === 0) {
        // Sempre avisa, mesmo na atualização automática: costuma ser a conta errada conectada.
        toast.error(`A Meta não devolveu nenhuma campanha da conta ${account}. Confira em Integrações se é a conta de anúncios certa.`);
      } else if (!silent) {
        toast.success(
          `${account}: ${plural(data.campaignsFound, "campanha encontrada", "campanhas encontradas")}. ` +
          `Sincronizado: ${plural(data.campaignsCreated, "campanha nova", "campanhas novas")}, ${plural(
            data.campaignsUpdated,
            "com status ou nome atualizado",
            "com status ou nome atualizados",
          )}, ${plural(data.metricsUpserted, "dia de métrica", "dias de métrica")}` +
          (typeof data.adSetsSynced === "number" ? `, ${plural(data.adSetsSynced, "conjunto", "conjuntos")} e ${plural(data.adsSynced ?? 0, "anúncio", "anúncios")}` : "") +
          ` (últimos ${data.periodDays} dias).`,
        );
      }
      if (data.levelsError) toast.error(`Campanhas atualizadas, mas conjuntos e anúncios falharam: ${data.levelsError}`);
      router.refresh();
    } catch {
      if (!silent) toast.error("Erro de rede — tente novamente.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!autoSync || autoRan.current) return;
    autoRan.current = true;
    void sync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync]);

  return (
    <button
      type="button"
      onClick={() => void sync(false)}
      disabled={syncing}
      className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] hover:border-[#FF2B00] hover:text-[#FF2B00] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {syncing ? "Sincronizando…" : "Atualizar da Meta"}
    </button>
  );
}
