"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/lib/dialogs";

const BTN = "h-8 rounded-md border px-3 text-xs font-semibold disabled:opacity-60";

/** Abrir no WhatsApp (mensagem pronta) + "Já enviei", pra rotina da manhã. */
export function ProspectWhatsappButtons({ id, url, step }: { id: string; url: string; step: "first" | "followup" }) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);

  async function done() {
    setBusy(true);
    const res = await fetch(`/api/prospecting/${id}/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível registrar.", { title: "Não registrou" });
    router.refresh();
  }

  return (
    <div className="flex gap-1.5">
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} className={`${BTN} inline-flex items-center border-[#12B76A] bg-white text-[#027A48]`}>
        Abrir no WhatsApp
      </a>
      <button type="button" disabled={busy} onClick={() => void done()} className={`${BTN} ${opened ? "border-[#12B76A] bg-[#12B76A] text-white" : "border-[#D0D5DD] bg-white text-[#344054]"}`}>
        {busy ? "Salvando..." : "Já enviei"}
      </button>
    </div>
  );
}
