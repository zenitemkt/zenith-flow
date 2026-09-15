"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { FinanceEntryStatus, FinanceEntryType } from "@zenith/db";
import { FINANCE_STATUS_LABELS } from "@/lib/finance";

export function FinanceEntryActions({
  entryId,
  type,
  status,
  options,
  canReverse,
}: {
  entryId: string;
  type: FinanceEntryType;
  status: FinanceEntryStatus;
  options: FinanceEntryStatus[];
  canReverse: boolean;
}) {
  const router = useRouter();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function move(toStatus: FinanceEntryStatus) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/finance/entries/${entryId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    router.refresh();
  }

  async function handleReverseSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/finance/entries/${entryId}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível estornar.");
      return;
    }
    setReversing(false);
    router.refresh();
  }

  if (reversing) {
    return (
      <form onSubmit={handleReverseSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo do estorno"
          className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#FF2B00]"
        />
        {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setReversing(false)}
            className="flex h-7 items-center justify-center rounded-md px-2 text-xs font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !reason.trim()}
            className="flex h-7 items-center justify-center rounded-md px-2 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#D94343" }}
          >
            Estornar
          </button>
        </div>
      </form>
    );
  }

  if (options.length === 0 && !canReverse) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={loading}
            onClick={() => void move(option)}
            className="flex h-7 items-center justify-center rounded-md border border-[#D0D5DD] px-2 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {FINANCE_STATUS_LABELS[type][option]}
          </button>
        ))}
        {canReverse && (
          <button
            type="button"
            onClick={() => setReversing(true)}
            className="flex h-7 items-center justify-center rounded-md border border-[#D0D5DD] px-2 text-xs font-medium text-[#B42318] hover:bg-[#FEE4E2]"
          >
            Estornar
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
