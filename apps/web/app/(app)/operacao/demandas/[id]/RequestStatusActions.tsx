"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RequestStatus, RequestPriority } from "@zenith/db";
import { REQUEST_STATUS_LABELS, REQUEST_PRIORITY_LABELS } from "@/lib/requests";

const REASON_REQUIRED: RequestStatus[] = ["REJEITADA"];
const PRIORITY_OFFERED: RequestStatus[] = ["TRIAGEM", "APROVADA"];
const PRIORITY_OPTIONS: RequestPriority[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];

export function RequestStatusActions({
  requestId,
  options,
}: {
  requestId: string;
  options: RequestStatus[];
}) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<RequestStatus | null>(null);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<RequestPriority | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(toStatus: RequestStatus, reasonValue: string | null, priorityValue: string) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/requests/${requestId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus,
        reason: reasonValue,
        priority: priorityValue || undefined,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    setPendingTarget(null);
    setReason("");
    setPriority("");
    router.refresh();
  }

  if (options.length === 0) return null;

  const needsPanel = (option: RequestStatus) =>
    REASON_REQUIRED.includes(option) || PRIORITY_OFFERED.includes(option);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={loading}
            onClick={() => {
              if (needsPanel(option)) {
                setPendingTarget(option);
              } else {
                void submit(option, null, "");
              }
            }}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {REQUEST_STATUS_LABELS[option]}
          </button>
        ))}
      </div>

      {pendingTarget && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-3">
          {PRIORITY_OFFERED.includes(pendingTarget) && (
            <div className="flex items-center gap-2">
              <label htmlFor="priority-select" className="text-sm text-[#344054]">
                Prioridade:
              </label>
              <select
                id="priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
                className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
              >
                <option value="">Manter atual</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {REQUEST_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {REASON_REQUIRED.includes(pendingTarget) && (
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo da rejeição"
              className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                loading || (REASON_REQUIRED.includes(pendingTarget) && !reason.trim())
              }
              onClick={() => void submit(pendingTarget, reason.trim() || null, priority)}
              className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#6847F5" }}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setPendingTarget(null)}
              className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-white"
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
