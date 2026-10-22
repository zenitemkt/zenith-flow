"use client";

import { useState } from "react";
import { useToast } from "@zenite-mkt/ui";

/** Diagnóstico (seção 6) — dispara um evento de teste direto pra Conversions API, fora do fluxo normal do coletor. */
export function SendTestMetaEventButton() {
  const toast = useToast();
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const response = await fetch("/api/integrations/meta/test-event", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Não foi possível enviar o evento de teste.");
        return;
      }
      toast.success(data.message ?? "Evento de teste enviado.");
    } catch {
      toast.error("Erro de rede — tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className="h-8 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054] hover:border-[#FF2B00] hover:text-[#FF2B00] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {sending ? "Enviando…" : "Mandar evento de teste"}
    </button>
  );
}
