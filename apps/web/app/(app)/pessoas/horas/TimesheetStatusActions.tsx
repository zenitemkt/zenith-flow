"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TimesheetStatus } from "@zenite-mkt/db";
import { TIMESHEET_STATUS_LABELS } from "@/lib/timesheets";

export function TimesheetStatusActions({
  timesheetId,
  options,
}: {
  timesheetId: string;
  options: TimesheetStatus[];
}) {
  const router = useRouter();
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function move(toStatus: TimesheetStatus, extraReason?: string) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/timesheets/${timesheetId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason: extraReason }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    setCorrecting(false);
    router.refresh();
  }

  function handleCorrectSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    void move("CORRIGIDA", reason.trim());
  }

  if (options.length === 0) return null;

  if (correcting) {
    return (
      <form onSubmit={handleCorrectSubmit} className="flex flex-col gap-2">
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="O que precisa ser corrigido?"
          rows={2}
          required
          className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
        />
        {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCorrecting(false)}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={loading || !reason.trim()}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#D94343" }}
          >
            Pedir correção
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
            onClick={() => (option === "CORRIGIDA" ? setCorrecting(true) : move(option))}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {TIMESHEET_STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
