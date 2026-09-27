"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SendApprovalModal } from "./SendApprovalModal";

export function SubmitForApprovalButton({
  contentId,
  defaultEmail,
  defaultWhatsapp,
}: {
  contentId: string;
  defaultEmail?: string | null;
  defaultWhatsapp?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/content/${contentId}/submit`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Não foi possível enviar para aprovação.");
      return;
    }

    setApprovalUrl(new URL(body.approvalUrl, window.location.origin).toString());
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    // Só atualiza a página ao fechar: um refresh imediato faz o status virar
    // "Aguardando cliente" e este botão (que só existe pra REVISAO_INTERNA/
    // AJUSTES) desmontar na hora, levando a janela junto antes do usuário
    // conseguir ver o link/enviar e-mail/WhatsApp.
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
        <SendApprovalModal
          contentId={contentId}
          open={modalOpen}
          onClose={handleModalClose}
          approvalUrl={approvalUrl}
          defaultEmail={defaultEmail}
          defaultWhatsapp={defaultWhatsapp}
        />
      )}
    </div>
  );
}
