"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProspectStatus } from "@zenite-mkt/db";
import { alertDialog, confirmDialog } from "@/lib/dialogs";

const BTN = "h-7 rounded-md border border-[#D0D5DD] bg-white px-2 text-[11px] font-semibold text-[#344054] disabled:opacity-60";

interface Props {
  id: string;
  status: ProspectStatus;
  leadId: string | null;
  /** Link wa.me com a mensagem pronta (só pra celular e ainda sem primeiro contato). */
  whatsappUrl: string | null;
}

export function ProspectRowActions({ id, status, leadId, whatsappUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível atualizar.", { title: "Não atualizou" });
    router.refresh();
  }

  async function act(action: "lead" | "discard" | "restore") {
    if (action === "lead" && !(await confirmDialog("A empresa vai entrar em Leads, no Comercial. Use quando ela já engajou (respondeu, demonstrou interesse).", { title: "Virar lead?" }))) return;
    await call(`/api/prospecting/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
  }

  if (status === "VIROU_LEAD") {
    return leadId ? <Link href={`/comercial/leads/${leadId}`} className="text-[11px] font-semibold text-[#FF2B00] hover:underline">Ver lead</Link> : null;
  }
  if (status === "DESQUALIFICADO") {
    return <button type="button" disabled={busy} onClick={() => void act("restore")} className={BTN}>Voltar pra lista</button>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {whatsappUrl && (
        <>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} className={`${BTN} inline-flex items-center border-[#12B76A] text-[#027A48]`}>
            WhatsApp
          </a>
          <button type="button" disabled={busy} onClick={() => void call(`/api/prospecting/${id}/whatsapp`, { method: "POST" })} className={`${BTN} ${opened ? "border-[#12B76A] bg-[#ECFDF3] text-[#027A48]" : ""}`}>
            Já enviei
          </button>
        </>
      )}
      <button type="button" disabled={busy} onClick={() => void act("lead")} className={BTN}>Virar lead</button>
      <button type="button" disabled={busy} onClick={() => void act("discard")} className={BTN}>Descartar</button>
    </div>
  );
}
