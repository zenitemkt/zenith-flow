"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { alertDialog } from "@/lib/dialogs";

/** Sugestão de primeira mensagem + "Já enviei": a Milena assume quando o lead responder. */
export function FirstContactCard({ leadId, phone, suggestion, status }: { leadId: string; phone: string; suggestion: string; status: "none" | "waiting" | "active" }) {
  const router = useRouter();
  const [text, setText] = useState(suggestion);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handoff() {
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/milena-handoff`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      await alertDialog(body?.error ?? "Não foi possível marcar.", { title: "Não marcou" });
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
      <div className="flex items-center gap-2">
        <MessageCircle size={16} className="text-[#12B76A]" aria-hidden />
        <h2 className="text-sm font-semibold text-[#101828]">Primeiro contato no WhatsApp</h2>
      </div>
      {status === "active" ? (
        <p className="mt-2 text-xs text-[#667085]">Já existe conversa com este lead. Acompanhe em Conversas.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#667085]">
            Mande pelo WhatsApp Business do número comercial (19 93619-6876). Ajuste o texto se quiser, envie e clique em &quot;Já enviei&quot;: a mensagem conta como da Milena, e quando a pessoa responder ela segue a conversa sozinha.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-3 w-full resize-y rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy()} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054]">
              <Copy size={14} aria-hidden />
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054]">
              <ExternalLink size={14} aria-hidden />
              Abrir no WhatsApp
            </a>
            <button type="button" disabled={busy || status === "waiting"} onClick={() => void handoff()} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#12B76A] px-3 text-xs font-semibold text-white disabled:opacity-60">
              {status === "waiting" ? "Enviado: Milena assume na resposta" : busy ? "Marcando..." : "Já enviei: Milena assume"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
