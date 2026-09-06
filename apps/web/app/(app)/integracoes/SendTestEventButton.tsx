"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Chama o coletor público (`/api/collect/v1/events`) igual a um site externo chamaria — prova o pipeline ponta a ponta. */
export function SendTestEventButton({ writeKey }: { writeKey: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendTestEvent() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/collect/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writeKey,
          events: [
            {
              eventName: "page_view",
              eventId: crypto.randomUUID(),
              occurredAt: new Date().toISOString(),
              url: `${location.origin}/integracoes?teste=1`,
              consent: { essencial: true, analytics: true, marketing: false, personalizacao: false },
            },
          ],
        }),
      });
      const body = await response.json().catch(() => null);
      const status = body?.results?.[0]?.status;
      setMessage(
        !response.ok
          ? (body?.error ?? "Falhou.")
          : status === "stored"
            ? "Evento de teste recebido com sucesso."
            : `Resposta inesperada: ${status ?? "desconhecida"}.`,
      );
    } catch {
      setMessage("Não foi possível contatar o coletor.");
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-[#667085]">{message}</span>}
      <button
        type="button"
        disabled={loading}
        onClick={() => void sendTestEvent()}
        className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#6847F5" }}
      >
        {loading ? "Enviando..." : "Enviar evento de teste"}
      </button>
    </div>
  );
}
