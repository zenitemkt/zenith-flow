"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível converter o lead.");
      return;
    }
    const body = await response.json();
    router.push(`/clientes/${body.clientId}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#16A36A" }}
      >
        {loading ? "Convertendo..." : "Tornar cliente"}
      </button>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
