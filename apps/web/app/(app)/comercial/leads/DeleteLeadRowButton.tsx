"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LeadDeleteDialog } from "./LeadDeleteDialog";

export function DeleteLeadRowButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível excluir o lead.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Não foi possível excluir o lead. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        aria-label={`Excluir lead ${leadName}`}
        title="Excluir lead"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#98A2B3] transition-colors hover:bg-[#FEF3F2] hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <LeadDeleteDialog
        open={open}
        leadName={leadName}
        loading={loading}
        error={error}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={() => void remove()}
      />
    </>
  );
}