"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

export function ReviewReplyEditor({ reviewId, initialText = "" }: { reviewId: string; initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  async function act(action: "save_draft" | "approve" | "ignore") {
    setBusy(action);
    const response = await fetch(`/api/google-business/reviews/${reviewId}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, text }) });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return toast.error(body.error ?? "Não foi possível atualizar a avaliação.");
    toast.success(action === "save_draft" ? "Rascunho salvo." : action === "approve" ? "Resposta aprovada para envio." : "Avaliação removida da fila.");
    router.refresh();
  }
  return <div className="mt-3 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-3"><label className="text-xs font-semibold text-[#344054]" htmlFor={`reply-${reviewId}`}>Preparar resposta</label><textarea id={`reply-${reviewId}`} value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={1500} placeholder="Escreva uma resposta específica e respeitosa..." className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white p-2.5 text-sm text-[#101828] outline-none focus:border-[#FF2B00]" /><div className="mt-2 flex flex-wrap gap-2"><button disabled={Boolean(busy)} onClick={() => void act("save_draft")} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054]">{busy === "save_draft" ? "Salvando..." : "Salvar rascunho"}</button><button disabled={Boolean(busy) || !text.trim()} onClick={() => void act("approve")} className="rounded-lg bg-[#FF2B00] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy === "approve" ? "Aprovando..." : "Aprovar resposta"}</button><button disabled={Boolean(busy)} onClick={() => void act("ignore")} className="px-2 py-1.5 text-xs font-semibold text-[#667085]">Ignorar</button></div></div>;
}
