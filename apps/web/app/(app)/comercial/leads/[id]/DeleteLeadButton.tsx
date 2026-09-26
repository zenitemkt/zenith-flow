"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeadDeleteDialog } from "../LeadDeleteDialog";

export function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
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
      router.push("/comercial/leads");
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
        disabled={loading}
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#FDA29B] px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60"
      >
        Excluir lead
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