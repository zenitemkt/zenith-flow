"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

interface DeleteRecordButtonProps {
  endpoint: string;
  recordName: string;
  entityLabel: string;
  warning: string;
  redirectTo?: string;
  variant?: "icon" | "button";
}

export function DeleteRecordButton({ endpoint, recordName, entityLabel, warning, redirectTo, variant = "icon" }: DeleteRecordButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setLoading(true);
    setError(null);
    const response = await fetch(endpoint, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? `Não foi possível excluir ${entityLabel.toLowerCase()}.`);
      setLoading(false);
      return;
    }
    setOpen(false);
    if (redirectTo) router.replace(redirectTo);
    else router.refresh();
  }

  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Excluir ${entityLabel.toLowerCase()} ${recordName}`} title={`Excluir ${entityLabel.toLowerCase()}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#D92D20] hover:bg-[#FEF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D92D20] focus-visible:ring-offset-2">
          <Trash2 size={16} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#FDA29B] px-3 text-sm font-semibold text-[#B42318] hover:bg-[#FEF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D92D20] focus-visible:ring-offset-2">
          <Trash2 size={15} aria-hidden /> Excluir {entityLabel.toLowerCase()}
        </button>
      )}

      <Modal open={open} onClose={loading ? () => undefined : () => setOpen(false)} title={`Excluir ${entityLabel.toLowerCase()}?`}>
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF3F2] text-[#D92D20]"><AlertTriangle size={20} aria-hidden /></div>
          <div className="min-w-0">
            <p className="text-sm leading-6 text-[#475467]">O registro <strong className="font-semibold text-[#101828]">“{recordName}”</strong> será excluído permanentemente.</p>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{warning} Esta ação não pode ser desfeita.</p>
          </div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-[#FEF3F2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setOpen(false)} disabled={loading} className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void confirmDelete()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#D92D20] px-4 text-sm font-semibold text-white hover:bg-[#B42318] disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}{loading ? "Excluindo..." : `Excluir ${entityLabel.toLowerCase()}`}
          </button>
        </div>
      </Modal>
    </>
  );
}
