"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LeaveRequestStatus } from "@zenith/db";
import { LEAVE_STATUS_LABELS } from "@/lib/employees";

export function LeaveStatusActions({
  leaveId,
  options,
}: {
  leaveId: string;
  options: LeaveRequestStatus[];
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function move(toStatus: LeaveRequestStatus, extraReason?: string) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/leave-requests/${leaveId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, rejectionReason: extraReason }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    setRejecting(false);
    router.refresh();
  }

  function handleRejectSubmit(event: FormEvent) {
    event.preventDefault();
    if (!rejectionReason.trim()) return;
    void move("REJEITADA", rejectionReason.trim());
  }

  if (options.length === 0) return null;

  if (rejecting) {
    return (
      <form onSubmit={handleRejectSubmit} className="flex flex-col gap-2">
        <textarea
          autoFocus
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Motivo da rejeição"
          rows={2}
          required
          className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
        />
        {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejecting(false)}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={loading || !rejectionReason.trim()}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#D94343" }}
          >
            Rejeitar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={loading}
            onClick={() => (option === "REJEITADA" ? setRejecting(true) : move(option))}
            className="flex h-8 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {LEAVE_STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
