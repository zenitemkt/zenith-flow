"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface ClientOption {
  id: string;
  name: string;
}

export function AllocateClientForm({ squadId, options }: { squadId: string; options: ClientOption[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(options[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/squads/${squadId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível alocar.");
      return;
    }

    router.refresh();
  }

  if (options.length === 0) {
    return <p className="text-xs text-[#98A2B3]">Nenhum cliente cadastrado ainda.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="h-9 flex-1 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading}
        className="flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#6847F5" }}
      >
        Alocar
      </button>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </form>
  );
}
