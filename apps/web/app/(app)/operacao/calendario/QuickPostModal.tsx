"use client";

import { useState } from "react";
import { Modal } from "@zenite-mkt/ui";
import { QuickPostForm, todaySP, type QuickPostClient } from "../_components/QuickPostForm";

export { todaySP, type QuickPostClient };

/** "Nova publicação" do Calendário: o formulário de publicação direta num modal, já no dia clicado. */
export function QuickPostModal({
  open,
  onClose,
  initialDate,
  initialClientId,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  initialDate: string;
  initialClientId?: string;
  clients: QuickPostClient[];
}) {
  // O modal desmonta o formulário ao fechar, então cada abertura começa limpa.
  // Enquanto envia, o fechar fica bloqueado (o formulário avisa por aqui).
  const [locked, setLocked] = useState(false);
  return (
    <Modal
      open={open}
      onClose={() => !locked && onClose()}
      size="xl"
      title="Nova publicação"
      description="Agende ou publique direto, sem precisar de um cartão antes."
    >
      <QuickPostForm
        mode="schedule"
        clients={clients}
        initialDate={initialDate}
        initialClientId={initialClientId}
        source="pelo Calendário"
        onClose={onClose}
        onBusyChange={setLocked}
      />
    </Modal>
  );
}
