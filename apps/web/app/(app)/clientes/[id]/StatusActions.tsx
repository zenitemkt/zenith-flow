"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientStatus } from "@zenite-mkt/db";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";

const REASON_REQUIRED: ClientStatus[] = ["PAUSADO", "EM_ENCERRAMENTO"];

export function StatusActions({ clientId, options }: { clientId: string; options: ClientStatus[] }) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<ClientStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(toStatus: ClientStatus, reasonValue: string | null) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/clients/${clientId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason: reasonValue }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    setPendingTarget(null);
    setReason("");
    router.refresh();
  }

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={loading}
            onClick={() => {
              if (REASON_REQUIRED.includes(option)) {
                setPendingTarget(option);
              } else {
                void submit(option, null);
              }
            }}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {CLIENT_STATUS_LABELS[option]}
          </button>
        ))}
      </div>

      {pendingTarget && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-3 sm:flex-row sm:items-center">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Motivo para mudar para "${CLIENT_STATUS_LABELS[pendingTarget]}"`}
            className="h-10 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !reason.trim()}
              onClick={() => void submit(pendingTarget, reason.trim())}
              className="flex h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setPendingTarget(null)}
              className="flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
