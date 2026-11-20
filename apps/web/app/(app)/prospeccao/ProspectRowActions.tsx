"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProspectStatus } from "@zenite-mkt/db";
import { alertDialog, confirmDialog } from "@/lib/dialogs";

const BTN = "h-7 rounded-md border border-[#D0D5DD] bg-white px-2 text-[11px] font-semibold text-[#344054] disabled:opacity-60";

export function ProspectRowActions({ id, status, leadId }: { id: string; status: ProspectStatus; leadId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "lead" | "discard" | "restore") {
    if (action === "lead" && !(await confirmDialog("A empresa vai entrar em Leads, no Comercial. Use quando ela já engajou (respondeu, demonstrou interesse).", { title: "Virar lead?" }))) return;
    setBusy(true);
    const res = await fetch(`/api/prospecting/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível atualizar.", { title: "Não atualizou" });
    router.refresh();
  }

  if (status === "VIROU_LEAD") {
    return leadId ? <Link href={`/comercial/leads/${leadId}`} className="text-[11px] font-semibold text-[#FF2B00] hover:underline">Ver lead</Link> : null;
  }
  if (status === "DESQUALIFICADO") {
    return <button type="button" disabled={busy} onClick={() => void act("restore")} className={BTN}>Voltar pra lista</button>;
  }
  return (
    <div className="flex gap-1">
      <button type="button" disabled={busy} onClick={() => void act("lead")} className={BTN}>Virar lead</button>
      <button type="button" disabled={busy} onClick={() => void act("discard")} className={BTN}>Descartar</button>
    </div>
  );
}
