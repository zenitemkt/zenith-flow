"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { alertDialog } from "@/lib/dialogs";

export function ProspectEmailSendButton({ due, enabled }: { due: number; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    const res = await fetch("/api/prospecting/emails/send", { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível enviar.", { title: "Não enviou" });
    setSummary(`${body.sent} enviado(s)${body.failed ? `, ${body.failed} com falha` : ""}${body.limitReached ? ". Limite do dia atingido, o resto sai amanhã." : "."}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={!enabled || busy || due === 0} onClick={() => void send()} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] disabled:opacity-60">
        <Mail size={16} aria-hidden /> {busy ? "Enviando..." : `Enviar e-mails de hoje (${due})`}
      </button>
      {!enabled && <p className="text-[11px] text-[#667085]">Ligue os e-mails automáticos em &quot;Primeiro contato e e-mails&quot;.</p>}
      {summary && <p className="text-[11px] font-medium text-[#027A48]">{summary}</p>}
    </div>
  );
}
