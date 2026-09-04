"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RoutineStatus } from "@zenith/db";

export function RoutineActions({ routineId, status }: { routineId: string; status: RoutineStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<{
    message: string;
    projectId?: string;
  } | null>(null);

  async function call(action: "activate" | "pause" | "generate") {
    setError(null);
    setGenerateResult(null);
    setLoading(action);
    const response = await fetch(`/api/routines/${routineId}/${action}`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setLoading(null);

    if (!response.ok) {
      setError(body?.error ?? "Não foi possível concluir a ação.");
      return;
    }

    if (action === "generate") {
      setGenerateResult({
        message:
          body.status === "created"
            ? "Gerado agora — projeto novo criado com as tarefas."
            : "Este período já tinha sido gerado antes (idempotente — nada duplicado).",
        projectId: body.projectId,
      });
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {(status === "RASCUNHO" || status === "PAUSADO") && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void call("activate")}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            Ativar
          </button>
        )}
        {status === "ATIVO" && (
          <>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void call("pause")}
              className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
            >
              Pausar
            </button>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void call("generate")}
              className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#6847F5" }}
            >
              Gerar agora
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      {generateResult && (
        <p className="max-w-xs text-right text-sm text-[#475467]">
          {generateResult.message}{" "}
          {generateResult.projectId && (
            <Link
              href={`/operacao/projetos/${generateResult.projectId}`}
              className="font-medium text-[#6847F5] hover:underline"
            >
              ver projeto
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
