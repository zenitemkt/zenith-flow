"use client";

import { Modal } from "@zenite-mkt/ui";
import { AlertTriangle, Loader2 } from "lucide-react";

export function LeadDeleteDialog({
  open,
  leadName,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={loading ? () => undefined : onCancel} title="Excluir lead?">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF3F2] text-[#D92D20]">
          <AlertTriangle size={20} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm leading-6 text-[#475467]">
            O lead <strong className="font-semibold text-[#101828]">“{leadName}”</strong> será excluído permanentemente.
          </p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            As oportunidades vinculadas também serão removidas do Pipeline. Esta ação não pode ser desfeita.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#FEF3F2] px-3 py-2 text-sm font-medium text-[#B42318]">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D0D5DD] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#D92D20] px-4 text-sm font-semibold text-white hover:bg-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D92D20] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {loading ? "Excluindo..." : "Excluir lead"}
        </button>
      </div>
    </Modal>
  );
}