"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Copy, ExternalLink } from "lucide-react";

/** Retomar conversa parada: abre o wa.me com a mensagem pronta, o admin só aperta Enter. */
export function FollowUpCard({
  leadId,
  phone,
  suggestion,
  silentLabel,
  needsFollowUp,
  previousFollowUps,
}: {
  leadId: string;
  phone: string;
  suggestion: string;
  silentLabel: string;
  needsFollowUp: boolean;
  previousFollowUps: number;
}) {
  const router = useRouter();
  const [text, setText] = useState(suggestion);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // O link abre direto (sem esperar a API, para o navegador não bloquear a nova aba).
  function registerOpen() {
    void fetch(`/api/leads/${leadId}/follow-up`, { method: "POST", keepalive: true })
      .catch(() => null)
      .finally(() => router.refresh());
  }

  return (
    <section className={`rounded-2xl border bg-white p-5 ${needsFollowUp ? "border-[#FDA29B]" : "border-[#E4E7EC]"}`}>
      <div className="flex items-center gap-2">
        {needsFollowUp ? <AlertCircle size={16} className="text-[#D92D20]" aria-hidden /> : <Clock size={16} className="text-[#667085]" aria-hidden />}
        <h2 className="text-sm font-semibold text-[#101828]">Retomar conversa no WhatsApp</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${needsFollowUp ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2F4F7] text-[#475467]"}`}>Sem resposta {silentLabel}</span>
      </div>
      <p className="mt-1 text-xs text-[#667085]">
        A última mensagem foi nossa e o lead não respondeu.
        {previousFollowUps > 0 ? ` Já foi feita ${previousFollowUps} retomada${previousFollowUps === 1 ? "" : "s"} desde a última resposta dele.` : ""} Ajuste o texto se quiser, clique em
        &quot;Abrir no WhatsApp&quot; e aperte Enter no celular/WhatsApp Web do número comercial. Se a Milena estiver conduzindo, ela segue quando a pessoa responder.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-3 w-full resize-y rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054]">
          <Copy size={14} aria-hidden />
          {copied ? "Copiado" : "Copiar"}
        </button>
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={registerOpen}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#12B76A] px-3 text-xs font-semibold text-white"
        >
          <ExternalLink size={14} aria-hidden />
          Abrir no WhatsApp
        </a>
      </div>
    </section>
  );
}
