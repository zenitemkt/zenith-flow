"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { alertDialog, confirmDialog } from "@/lib/dialogs";

/** A Milena manda a primeira mensagem no WhatsApp para quem preencheu o formulário e não chamou. */
export function MilenaStartButton({ leadId, preview }: { leadId: string; preview: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    const ok = await confirmDialog(`A Milena vai mandar esta mensagem no WhatsApp:\n\n"${preview}"\n\nQuando a pessoa responder, ela continua a conversa já sabendo as respostas do formulário.`, {
      title: "Milena chamar no WhatsApp",
      confirmLabel: "Enviar",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/milena-start`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      await alertDialog(body?.error ?? "Não foi possível enviar.", { title: "Não enviou" });
      return;
    }
    router.push(`/conversas?c=${encodeURIComponent(body.conversationKey)}`);
  }

  return (
    <button type="button" disabled={busy} onClick={() => void start()} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#12B76A] px-3 text-xs font-semibold text-white disabled:opacity-60">
      <MessageCircle size={14} aria-hidden />
      {busy ? "Enviando..." : "Milena chamar no WhatsApp"}
    </button>
  );
}
