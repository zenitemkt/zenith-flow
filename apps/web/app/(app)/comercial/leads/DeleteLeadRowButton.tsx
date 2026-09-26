"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteLeadRowButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    const confirmed = window.confirm(
      `Excluir o lead "${leadName}"? As oportunidades vinculadas também serão removidas. Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        window.alert(result.error ?? "Não foi possível excluir o lead.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={loading}
      aria-label={`Excluir lead ${leadName}`}
      title="Excluir lead"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#98A2B3] transition-colors hover:bg-[#FEF3F2] hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}