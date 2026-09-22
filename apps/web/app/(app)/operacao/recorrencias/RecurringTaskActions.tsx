"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RecurringTaskStatus } from "@zenite-mkt/db";

export function RecurringTaskActions({
  templateId,
  status,
}: {
  templateId: string;
  status: RecurringTaskStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function call(action: "activate" | "pause" | "generate") {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/recurring-tasks/${templateId}/${action}`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Não foi possível concluir a ação.");
      return;
    }
    if (action === "generate") {
      setMessage(
        body?.status === "created"
          ? "Ocorrência gerada."
          : body?.status === "already_exists"
            ? "Já gerada para este período."
            : "Nada pendente agora.",
      );
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {status === "ATIVO" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void call("generate")}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF2B00" }}
          >
            Gerar agora
          </button>
        )}
        {status === "ATIVO" ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void call("pause")}
            className="flex h-8 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] disabled:opacity-60"
          >
            Pausar
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void call("activate")}
            className="flex h-8 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] disabled:opacity-60"
          >
            Ativar
          </button>
        )}
      </div>
      {message && <p className="text-xs text-[#667085]">{message}</p>}
    </div>
  );
}
