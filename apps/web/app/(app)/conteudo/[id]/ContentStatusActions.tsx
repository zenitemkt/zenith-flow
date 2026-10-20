"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { ContentStatus } from "@zenite-mkt/db";
import { CONTENT_STATUS_LABELS } from "@/lib/content";

/**
 * Texto do botão pelo destino — "o que acontece se eu clicar", não o nome
 * técnico do status (pedido do usuário, 2026-10-20: cartão aberto confuso).
 */
const ACTION_LABEL: Partial<Record<ContentStatus, string>> = {
  PRODUCAO: "Começar produção",
  REVISAO_INTERNA: "Enviar para revisão interna",
  AGENDADO: "Marcar como agendado",
  PUBLICADO: "Marcar como publicado",
  ARQUIVADO: "Arquivar",
};

/** Quando a ação principal da tela é outra (ex.: enviar ao cliente), estes destinos viram secundários. */
const BACKWARD_LABEL: Partial<Record<ContentStatus, string>> = {
  PRODUCAO: "Voltar para produção",
};

export function ContentStatusActions({
  contentId,
  options,
  primary = true,
}: {
  contentId: string;
  options: ContentStatus[];
  /** false = renderiza tudo como ação secundária (outra ação já é a principal). */
  primary?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<ContentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(toStatus: ContentStatus) {
    if (loading) return;
    setError(null);
    setLoading(toStatus);
    const response = await fetch(`/api/content/${contentId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus }),
    });
    setLoading(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    router.refresh();
  }

  if (options.length === 0) return null;

  return (
    <>
      {options.map((option, index) => {
        const isPrimary = primary && index === 0 && option !== "ARQUIVADO";
        const label = isPrimary
          ? (ACTION_LABEL[option] ?? CONTENT_STATUS_LABELS[option])
          : (BACKWARD_LABEL[option] ?? ACTION_LABEL[option] ?? CONTENT_STATUS_LABELS[option]);
        return (
          <button
            key={option}
            type="button"
            disabled={loading !== null}
            onClick={() => void move(option)}
            className={
              isPrimary
                ? "flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                : "flex h-10 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white px-3.5 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
            }
            style={isPrimary ? { backgroundColor: "#FF2B00" } : undefined}
          >
            {loading === option ? "Salvando..." : label}
            {isPrimary && loading !== option && <ArrowRight size={15} aria-hidden />}
          </button>
        );
      })}
      {error && <p className="basis-full text-xs font-medium text-[#D94343]">{error}</p>}
    </>
  );
}
