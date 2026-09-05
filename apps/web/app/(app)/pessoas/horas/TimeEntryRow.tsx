"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMinutes } from "@/lib/timesheets";

interface TimeEntryRowProps {
  id: string;
  date: string;
  minutes: number;
  description: string | null;
  taskTitle: string | null;
  edited: boolean;
  needsReason: boolean;
  locked: boolean;
}

export function TimeEntryRow({ id, date, minutes, description, taskTitle, edited, needsReason, locked }: TimeEntryRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newMinutes, setNewMinutes] = useState(String(minutes));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (needsReason && !reason.trim()) {
      setError("Descreva o motivo da correção.");
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: Number(newMinutes), reason: reason.trim() || undefined }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível editar.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-[#EEF0F3] px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={newMinutes}
            onChange={(e) => setNewMinutes(e.target.value)}
            className="h-8 w-24 rounded-md border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
          />
          <span className="text-xs text-[#98A2B3]">minutos</span>
        </div>
        {needsReason && (
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da correção (obrigatório — folha já enviada)"
            className="h-8 rounded-md border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
          />
        )}
        {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex h-7 items-center justify-center rounded-md px-2 text-xs font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex h-7 items-center justify-center rounded-md px-2 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#6847F5" }}
          >
            Salvar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2">
      <div>
        <p className="text-sm font-medium text-[#101828]">
          {taskTitle ?? "Sem tarefa vinculada"} · {formatMinutes(minutes)}
          {edited && <span className="ml-1 text-xs text-[#98A2B3]">(editado)</span>}
        </p>
        <p className="text-xs text-[#98A2B3]">
          {new Date(date).toLocaleDateString("pt-BR")}
          {description ? ` · ${description}` : ""}
        </p>
      </div>
      {!locked && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-[#6847F5] hover:underline"
        >
          Editar
        </button>
      )}
      {locked && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-[#B54708] hover:underline"
        >
          Corrigir
        </button>
      )}
    </div>
  );
}
