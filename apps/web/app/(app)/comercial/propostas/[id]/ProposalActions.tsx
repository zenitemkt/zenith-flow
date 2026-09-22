"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProposalStatus } from "@zenite-mkt/db";
import { SendProposalModal } from "./SendProposalModal";

interface Props {
  proposalId: string;
  status: ProposalStatus;
  autoOpenSend?: boolean;
  defaultEmail?: string | null;
  defaultWhatsapp?: string | null;
}

export function ProposalActions({ proposalId, status, autoOpenSend, defaultEmail, defaultWhatsapp }: Props) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Popup abre sozinho quando vem do redirect de criação (`?send=1`), e limpa
  // a URL em seguida pra não reabrir num refresh manual da página.
  useEffect(() => {
    if (autoOpenSend) {
      setSendOpen(true);
      router.replace(`/comercial/propostas/${proposalId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function expire() {
    setError(null);
    setLoading("expire");
    const response = await fetch(`/api/proposals/${proposalId}/expire`, { method: "POST" });
    setLoading(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível concluir a ação.");
      return;
    }
    router.refresh();
  }

  const canSend = status === "RASCUNHO" || status === "ENVIADA" || status === "VISUALIZADA";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {canSend && (
          <button
            type="button"
            onClick={() => setSendOpen(true)}
            className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white"
            style={{ backgroundColor: "#FF2B00" }}
          >
            Enviar proposta
          </button>
        )}
        {(status === "ENVIADA" || status === "VISUALIZADA") && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void expire()}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {loading === "expire" ? "Expirando..." : "Marcar como expirada"}
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
      <SendProposalModal
        proposalId={proposalId}
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        defaultEmail={defaultEmail}
        defaultWhatsapp={defaultWhatsapp}
        onSent={() => router.refresh()}
      />
    </div>
  );
}
