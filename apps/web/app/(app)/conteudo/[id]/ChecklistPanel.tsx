"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export function ChecklistPanel({ contentId, items }: { contentId: string; items: ChecklistItem[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = items.filter((item) => item.done).length;

  async function toggle(item: ChecklistItem) {
    setError(null);
    setBusyId(item.id);
    const response = await fetch(`/api/content/${contentId}/checklist/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    setBusyId(null);
    if (!response.ok) {
      setError("Não foi possível atualizar o item.");
      return;
    }
    router.refresh();
  }

  async function remove(item: ChecklistItem) {
    setError(null);
    setBusyId(item.id);
    const response = await fetch(`/api/content/${contentId}/checklist/${item.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!response.ok) {
      setError("Não foi possível remover o item.");
      return;
    }
    router.refresh();
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    setAdding(true);
    const response = await fetch(`/api/content/${contentId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setAdding(false);
    if (!response.ok) {
      setError("Não foi possível adicionar o item.");
      return;
    }
    setTitle("");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#101828]">Checklist</h2>
        {items.length > 0 && (
          <span className="text-xs font-medium text-[#98A2B3]">
            {done}/{items.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-[#EEF0F3] px-3 py-2">
            <input
              type="checkbox"
              checked={item.done}
              disabled={busyId === item.id}
              onChange={() => void toggle(item)}
              className="h-4 w-4 rounded border-[#D0D5DD] accent-[#FF2B00]"
            />
            <span className={`flex-1 text-sm ${item.done ? "text-[#98A2B3] line-through" : "text-[#344054]"}`}>
              {item.title}
            </span>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => void remove(item)}
              aria-label={`Remover "${item.title}"`}
              className="text-[#98A2B3] hover:text-[#D94343]"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[#98A2B3]">Nenhum item ainda.</p>}
      </div>

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Adicionar item..."
          className="h-9 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {adding ? "..." : "Adicionar"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm font-medium text-[#D94343]">{error}</p>}
    </section>
  );
}
