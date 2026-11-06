"use client";

import { useState } from "react";
import { QuickPostForm, type QuickPostClient } from "../_components/QuickPostForm";

/** Publicar na hora: o formulário sem data/hora; "Fazer outra publicação" recomeça do zero (mesmo cliente). */
export function PublishNowPanel({ clients, initialClientId }: { clients: QuickPostClient[]; initialClientId?: string }) {
  const [round, setRound] = useState(0);
  return (
    <QuickPostForm
      key={round}
      mode="instant"
      clients={clients}
      initialClientId={initialClientId}
      source="pela Publicação"
      onReset={() => setRound((r) => r + 1)}
    />
  );
}
