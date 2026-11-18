"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { alertDialog } from "@/lib/dialogs";

/** Atualiza de uma vez o Google (ou o site) de todos os concorrentes diretos + cliente. Referências ficam de fora. */
export function CompetitorBulkSyncButton({ clientId, kind, label }: { clientId: string; kind: "google" | "site"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const res = await fetch("/api/competitors/bulk-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, kind }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível atualizar.", { title: "Não atualizou" });
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={() => void run()} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#344054] disabled:opacity-60">
      <RefreshCw size={14} aria-hidden /> {busy ? "Atualizando..." : label}
    </button>
  );
}
