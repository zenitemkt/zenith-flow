"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const confirmed = window.confirm(
      `Excluir o lead "${leadName}"? As oportunidades vinculadas também serão removidas. Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setLoading(false);
      setError(result.error || "Não foi possível excluir o lead.");
      return;
    }
    router.push("/comercial/leads");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void remove()}
        className="rounded-lg border border-[#FDA29B] px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60"
      >
        {loading ? "Excluindo..." : "Excluir lead"}
      </button>
      {error && <p className="text-xs text-[#B42318]">{error}</p>}
    </div>
  );
}