"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitForApprovalButton({ contentId }: { contentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setApprovalUrl(null);
    setLoading(true);
    const response = await fetch(`/api/content/${contentId}/submit`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Não foi possível enviar para aprovação.");
      return;
    }

    setApprovalUrl(new URL(body.approvalUrl, window.location.origin).toString());
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void submit()}
        className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#FF2B00" }}
      >
        {loading ? "Enviando..." : "Enviar para aprovação do cliente"}
      </button>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
      {approvalUrl && (
        <div className="max-w-xs rounded-lg bg-[#FFF1EC] p-2 text-right text-xs text-[#C2270A]">
          <p className="mb-1 font-medium">Link de aprovação (válido por 14 dias):</p>
          <code className="block break-all">{approvalUrl}</code>
        </div>
      )}
    </div>
  );
}
