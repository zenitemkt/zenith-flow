"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Position {
  id: string;
  title: string;
  description: string | null;
}

export function PositionsPanel({ positions }: { positions: Position[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setLoading(true);
    const response = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar o cargo.");
      return;
    }
    setTitle("");
    setAdding(false);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#101828]">Cargos</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-[#6847F5] hover:underline"
          >
            + Novo cargo
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {positions.length === 0 && !adding && (
          <p className="text-sm text-[#98A2B3]">Nenhum cargo cadastrado ainda — texto livre continua valendo ao criar uma pessoa.</p>
        )}
        {positions.map((position) => (
          <span
            key={position.id}
            className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#344054]"
          >
            {position.title}
          </span>
        ))}
      </div>
      {adding && (
        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Gestor de tráfego"
            className="h-9 flex-1 max-w-xs rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
          />
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#6847F5" }}
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054]"
          >
            Cancelar
          </button>
        </form>
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-[#D94343]">{error}</p>}
    </section>
  );
}
