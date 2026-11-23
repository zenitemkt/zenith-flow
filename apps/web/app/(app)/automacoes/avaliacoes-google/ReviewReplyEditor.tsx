"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useToast } from "@zenite-mkt/ui";

export function ReviewReplyEditor({ reviewId, initialText = "" }: { reviewId: string; initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function call(body: Record<string, unknown>) {
    const response = await fetch(`/api/google-business/reviews/${reviewId}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { response, data: await response.json().catch(() => ({})) };
  }

  async function act(action: "draft" | "approve" | "ignore") {
    setBusy(action);
    const { response, data } = await call({ action, text });
    setBusy(null);
    if (!response.ok) return toast.error(data.error ?? "Não foi possível atualizar a avaliação.");
    toast.success(action === "draft" ? "Rascunho salvo." : action === "approve" ? "Resposta aprovada para envio." : "Avaliação removida da fila.");
    router.refresh();
  }

  async function generate() {
    setBusy("generate");
    const { response, data } = await call({ action: "generate" });
    setBusy(null);
    if (!response.ok) return toast.error(data.error ?? "Não foi possível gerar a resposta.");
    setText(data.text ?? "");
  }

  return (
    <div className="mt-3 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-[#344054]" htmlFor={`reply-${reviewId}`}>Preparar resposta</label>
        <button type="button" disabled={Boolean(busy)} onClick={() => void generate()} className="flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1 text-xs font-semibold text-[#344054] disabled:opacity-60">
          <Sparkles size={13} className="text-[#FF2B00]" />{busy === "generate" ? "Gerando..." : text.trim() ? "Gerar outra com IA" : "Gerar com IA"}
        </button>
      </div>
      <textarea id={`reply-${reviewId}`} value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={1500} placeholder="Escreva uma resposta específica e respeitosa, ou gere uma com IA..." className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white p-2.5 text-sm text-[#101828] outline-none focus:border-[#FF2B00]" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={Boolean(busy)} onClick={() => void act("draft")} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054]">{busy === "draft" ? "Salvando..." : "Salvar rascunho"}</button>
        <button disabled={Boolean(busy) || !text.trim()} onClick={() => void act("approve")} className="rounded-lg bg-[#FF2B00] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy === "approve" ? "Aprovando..." : "Aprovar resposta"}</button>
        <button disabled={Boolean(busy)} onClick={() => void act("ignore")} className="px-2 py-1.5 text-xs font-semibold text-[#667085]">Ignorar</button>
      </div>
    </div>
  );
}
