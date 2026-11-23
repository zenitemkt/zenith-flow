"use client";

import { useState } from "react";
import { Save, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

export interface ReviewPolicyValue {
  autoReplyEnabled: boolean;
  autoReplyFourStars: boolean;
  autoReplyFiveStars: boolean;
  manualAtOrBelow: number;
  responseTone: string;
  extraGuidelines: string;
  notifyLowRatings: boolean;
  requireCommentForAuto: boolean;
}

export function ReviewPolicyForm({ initial, canManage }: { initial: ReviewPolicyValue; canManage: boolean }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const set = <K extends keyof ReviewPolicyValue>(key: K, next: ReviewPolicyValue[K]) => setValue((current) => ({ ...current, [key]: next }));

  async function save() {
    setSaving(true);
    const response = await fetch("/api/google-business/review-policy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return toast.error(result.error ?? "Não foi possível salvar a automação.");
    toast.success("Automação de avaliações salva.");
    router.refresh();
  }

  return <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
    <div className="flex flex-col gap-3 border-b border-[#EEF0F3] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold text-[#101828]"><Sparkles size={16} className="text-[#FF2B00]" />Regras de resposta</h2><p className="mt-1 text-xs text-[#667085]">A automação só será executada depois que a conta Google estiver aprovada e conectada.</p></div>
      <label className="flex items-center gap-2 text-sm font-medium text-[#344054]"><input type="checkbox" checked={value.autoReplyEnabled} disabled={!canManage} onChange={(e) => set("autoReplyEnabled", e.target.checked)} className="h-4 w-4 accent-[#FF2B00]" />Ativar respostas automáticas</label>
    </div>
    <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
      <div className="border-b border-[#EEF0F3] bg-[#F9FAFB] p-4 lg:border-b-0 lg:border-r">
        <p className="text-sm font-semibold text-[#101828]">Triagem segura</p>
        <div className="mt-3 space-y-3 text-sm text-[#475467]">
          <label className="flex items-start gap-2"><input type="checkbox" checked={value.autoReplyFiveStars} disabled={!canManage} onChange={(e) => set("autoReplyFiveStars", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FF2B00]" /><span><b className="text-[#101828]">5 estrelas</b><br /><span className="text-xs">Resposta automática</span></span></label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={value.autoReplyFourStars} disabled={!canManage} onChange={(e) => set("autoReplyFourStars", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FF2B00]" /><span><b className="text-[#101828]">4 estrelas</b><br /><span className="text-xs">Resposta automática</span></span></label>
          <div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 text-[#B54708]" /><span><b className="text-[#101828]">1 a 3 estrelas</b><br /><span className="text-xs">Sempre passam pela equipe</span></span></div>
          <label className="flex items-start gap-2"><input type="checkbox" checked={value.requireCommentForAuto} disabled={!canManage} onChange={(e) => set("requireCommentForAuto", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FF2B00]" /><span className="text-xs">Só responder automaticamente quando houver comentário</span></label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={value.notifyLowRatings} disabled={!canManage} onChange={(e) => set("notifyLowRatings", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FF2B00]" /><span className="text-xs">Avisar na Central de alertas quando chegar nota baixa</span></label>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#344054]">Tom de voz</span><input value={value.responseTone} disabled={!canManage} onChange={(e) => set("responseTone", e.target.value)} maxLength={240} className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]" /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#344054]">Orientações extras (opcional)</span><textarea value={value.extraGuidelines} disabled={!canManage} onChange={(e) => set("extraGuidelines", e.target.value)} rows={3} maxLength={800} placeholder="Ex.: mencione que atendemos aos sábados; nunca ofereça desconto na resposta." className="w-full rounded-lg border border-[#D0D5DD] bg-white p-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]" /></label>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#667085]">Cada avaliação recebe uma resposta única, escrita por IA a partir do que a pessoa escreveu, seguindo as boas práticas do Google (nada de texto padronizado repetido).</p>{canManage && <button onClick={() => void save()} disabled={saving} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF2B00] px-3 text-sm font-semibold text-white disabled:opacity-60"><Save size={15} />{saving ? "Salvando..." : "Salvar regras"}</button>}</div>
      </div>
    </div>
  </section>;
}
