"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/lib/dialogs";
import type { ProspectingConfig } from "@/lib/prospecting/config";

const FIELD = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";
const LABEL = "flex flex-col gap-1 text-xs font-medium text-[#344054]";
const STEP_LABELS = ["Primeiro e-mail", "Lembrete (3 dias depois, se não respondeu)"];

/** Textos do primeiro contato e configuração dos e-mails automáticos. */
export function ProspectOutreachForm({ config }: { config: ProspectingConfig }) {
  const router = useRouter();
  const [opener, setOpener] = useState(config.whatsappOpener);
  const [followUp, setFollowUp] = useState(config.whatsappFollowUp);
  const [email, setEmail] = useState(config.email);
  const [limits, setLimits] = useState(config.dailyLimits);
  const [busy, setBusy] = useState(false);

  const setStep = (i: number, field: "subject" | "body", value: string) =>
    setEmail((e) => ({ ...e, steps: e.steps.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }));

  async function save() {
    setBusy(true);
    const res = await fetch("/api/prospecting/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { ...config, whatsappOpener: opener, whatsappFollowUp: followUp, email, dailyLimits: limits } }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível salvar.", { title: "Não salvou" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-[#667085]">Variáveis: {"{empresa}"}, {"{nicho}"}, {"{cidade}"} e {"{gancho}"} (frase montada pra cada empresa: sem site, nota ou avaliações no Google).</p>

      <label className={LABEL}>
        Primeira mensagem do WhatsApp (você envia pelo celular, como a Milena)
        <textarea rows={3} value={opener} onChange={(e) => setOpener(e.target.value)} className={FIELD} />
      </label>
      <label className={LABEL}>
        Follow-up do WhatsApp (3 dias depois, se não respondeu; também enviado à mão)
        <textarea rows={3} value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={FIELD} />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-[#101828]">
        <input type="checkbox" checked={email.enabled} onChange={(e) => setEmail({ ...email, enabled: e.target.checked })} />
        E-mails automáticos ligados
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          Remetente
          <input value={email.fromEmail} onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })} placeholder="Vazio = remetente padrão do sistema" className={FIELD} />
          <span className="font-normal text-[#98A2B3]">Ideal: um subdomínio só pra prospecção (ex.: contato@prospeccao.hubzenite.com.br), verificado no Resend.</span>
        </label>
        <label className={LABEL}>
          Respostas vão para
          <input value={email.replyTo} onChange={(e) => setEmail({ ...email, replyTo: e.target.value })} placeholder="respostas@prospeccao.hubzenite.com.br" className={FIELD} />
          <span className="font-normal text-[#98A2B3]">Use o endereço de recebimento do Resend: o sistema lê a resposta, para o lembrete e transforma em lead sozinho.</span>
        </label>
        <label className={LABEL}>
          Encaminhar respostas para
          <input value={email.forwardTo} onChange={(e) => setEmail({ ...email, forwardTo: e.target.value })} placeholder="seu@email.com" className={FIELD} />
          <span className="font-normal text-[#98A2B3]">Sua caixa: cada resposta chega aqui, com link pro lead.</span>
        </label>
      </div>
      {email.steps.map((step, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-[#EAECF0] p-3">
          <p className="text-xs font-semibold text-[#344054]">{STEP_LABELS[i]}</p>
          <input value={step.subject} onChange={(e) => setStep(i, "subject", e.target.value)} placeholder="Assunto" className={FIELD} />
          <textarea rows={6} value={step.body} onChange={(e) => setStep(i, "body", e.target.value)} className={FIELD} />
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          Primeiros contatos no WhatsApp por dia
          <input type="number" min={0} max={100} value={limits.whatsapp} onChange={(e) => setLimits({ ...limits, whatsapp: Number(e.target.value) })} className={FIELD} />
        </label>
        <label className={LABEL}>
          E-mails por dia
          <input type="number" min={0} max={500} value={limits.email} onChange={(e) => setLimits({ ...limits, email: Number(e.target.value) })} className={FIELD} />
          <span className="font-normal text-[#98A2B3]">O plano grátis do Resend permite 100 por dia.</span>
        </label>
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={busy} onClick={() => void save()} className="h-9 rounded-lg bg-[#FF2B00] px-4 text-xs font-semibold text-white disabled:opacity-60">
          {busy ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
