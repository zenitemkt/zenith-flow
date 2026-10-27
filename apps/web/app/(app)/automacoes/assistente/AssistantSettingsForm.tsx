"use client";

import { useState, type ReactNode } from "react";
import type { AssistantConfig } from "@/lib/assistant/config";

interface Props {
  initialEnabled: boolean;
  initialConfig: AssistantConfig;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const input = "w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] focus:border-[#FC4C13] focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#344054]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-[#667085]">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-[#101828]">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Editor das regras da assistente. Tudo aqui entra nas instruções dela na próxima mensagem. */
export function AssistantSettingsForm({ initialEnabled, initialConfig }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [config, setConfig] = useState(initialConfig);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set<K extends keyof AssistantConfig>(section: K, patch: Partial<AssistantConfig[K]>) {
    setConfig((current) => ({ ...current, [section]: typeof current[section] === "object" ? { ...(current[section] as object), ...patch } : patch }));
    setStatus("idle");
  }
  const num = (value: string) => Number(value.replace(",", ".")) || 0;
  const lines = (value: string) => value.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/assistant-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, config }) });
    setStatus(response.ok ? "saved" : "error");
  }

  const { icp, entryProduct: p, meeting: m, conversation: c, notifications: n, payment } = config;

  return (
    <div className="space-y-6">
      <Section title="Geral">
        <label className="flex items-center gap-2 text-sm text-[#344054] sm:col-span-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Assistente ligada (responde no WhatsApp comercial)
        </label>
        <Field label="Nome da assistente">
          <input className={input} value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} />
        </Field>
        <Field label="Espera antes de responder (segundos)" hint="Conta a partir da última mensagem da pessoa.">
          <input className={input} type="number" min={30} value={config.replyDelaySeconds} onChange={(e) => setConfig({ ...config, replyDelaySeconds: num(e.target.value) })} />
        </Field>
        <Field label="Modelo de IA">
          <input className={input} value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} />
        </Field>
      </Section>

      <Section title="Perfil de cliente ideal (triagem)">
        <Field label="Verba mínima de anúncios (R$/mês)">
          <input className={input} type="number" value={icp.minAdBudget} onChange={(e) => set("icp", { minAdBudget: num(e.target.value) })} />
        </Field>
        <Field label="Gestão mínima (R$/mês)">
          <input className={input} type="number" value={icp.minManagementFee} onChange={(e) => set("icp", { minManagementFee: num(e.target.value) })} />
        </Field>
        <Field label="Região preferida">
          <input className={input} value={icp.preferredRegion} onChange={(e) => set("icp", { preferredRegion: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm text-[#344054]">
          <input type="checkbox" checked={icp.preferPhysicalBusiness} onChange={(e) => set("icp", { preferPhysicalBusiness: e.target.checked })} />
          Preferência por negócio físico
        </label>
        <div className="sm:col-span-2">
          <Field label="Observações do perfil">
            <textarea className={input} rows={2} value={icp.notes} onChange={(e) => set("icp", { notes: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Produto de entrada (fora do perfil)">
        <Field label="Nome">
          <input className={input} value={p.name} onChange={(e) => set("entryProduct", { name: e.target.value })} />
        </Field>
        <Field label="Prazo de entrega (dias úteis)">
          <input className={input} type="number" value={p.deliveryBusinessDays} onChange={(e) => set("entryProduct", { deliveryBusinessDays: num(e.target.value) })} />
        </Field>
        <Field label="Preço no cartão (R$)">
          <input className={input} type="number" value={p.priceCard} onChange={(e) => set("entryProduct", { priceCard: num(e.target.value) })} />
        </Field>
        <Field label="Parcelas sem juros">
          <input className={input} type="number" value={p.maxInstallments} onChange={(e) => set("entryProduct", { maxInstallments: num(e.target.value) })} />
        </Field>
        <Field label="Preço no Pix (R$)">
          <input className={input} type="number" value={p.pricePix} onChange={(e) => set("entryProduct", { pricePix: num(e.target.value) })} />
        </Field>
        <Field label="Verba de anúncio sugerida (R$/mês)">
          <input className={input} type="number" value={p.suggestedAdBudget} onChange={(e) => set("entryProduct", { suggestedAdBudget: num(e.target.value) })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="O que é o produto">
            <textarea className={input} rows={4} value={p.description} onChange={(e) => set("entryProduct", { description: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Como é o ensino">
            <textarea className={input} rows={2} value={p.training} onChange={(e) => set("entryProduct", { training: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Reunião e agenda">
        <div className="sm:col-span-2">
          <Field label="Como a reunião é apresentada">
            <textarea className={input} rows={2} value={m.pitch} onChange={(e) => set("meeting", { pitch: e.target.value })} />
          </Field>
        </div>
        <Field label="Duração (minutos)">
          <input className={input} type="number" value={m.durationMinutes} onChange={(e) => set("meeting", { durationMinutes: num(e.target.value) })} />
        </Field>
        <Field label="Dias permitidos">
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((label, day) => (
              <label key={label} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={m.weekdays.includes(day)}
                  onChange={(e) => set("meeting", { weekdays: e.target.checked ? [...m.weekdays, day].sort() : m.weekdays.filter((d) => d !== day) })}
                />
                {label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Manhã (início e fim)">
          <div className="flex gap-2">
            <input className={input} type="time" value={m.morning.start} onChange={(e) => set("meeting", { morning: { ...m.morning, start: e.target.value } })} />
            <input className={input} type="time" value={m.morning.end} onChange={(e) => set("meeting", { morning: { ...m.morning, end: e.target.value } })} />
          </div>
        </Field>
        <Field label="Tarde (início e fim)">
          <div className="flex gap-2">
            <input className={input} type="time" value={m.afternoon.start} onChange={(e) => set("meeting", { afternoon: { ...m.afternoon, start: e.target.value } })} />
            <input className={input} type="time" value={m.afternoon.end} onChange={(e) => set("meeting", { afternoon: { ...m.afternoon, end: e.target.value } })} />
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <input type="checkbox" checked={m.saturdayMorningOnly} onChange={(e) => set("meeting", { saturdayMorningOnly: e.target.checked })} />
          Sábado só de manhã
        </label>
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <input type="checkbox" checked={m.preferMorning} onChange={(e) => set("meeting", { preferMorning: e.target.checked })} />
          Oferecer manhã primeiro
        </label>
        <Field label="Pedir ok dos sócios com menos de (horas)">
          <input className={input} type="number" value={m.partnerApprovalUnderHours} onChange={(e) => set("meeting", { partnerApprovalUnderHours: num(e.target.value) })} />
        </Field>
        <Field label="Tempo para os sócios responderem (min)">
          <input className={input} type="number" value={m.partnerApprovalTimeoutMinutes} onChange={(e) => set("meeting", { partnerApprovalTimeoutMinutes: num(e.target.value) })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Agendas dos sócios (e-mails do Google Agenda)" hint="Um por linha. A primeira é a que cria o evento; as outras entram como convidadas.">
            <textarea className={input} rows={2} value={m.calendarIds.join("\n")} onChange={(e) => set("meeting", { calendarIds: lines(e.target.value) })} />
          </Field>
        </div>
        <Field label="Lembrete antes da reunião (horas)">
          <input className={input} type="number" value={config.reminders.confirmHoursBefore} onChange={(e) => set("reminders", { confirmHoursBefore: num(e.target.value) })} />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm text-[#344054]">
          <input type="checkbox" checked={config.reminders.sendStartNotice} onChange={(e) => set("reminders", { sendStartNotice: e.target.checked })} />
          Avisar a pessoa na hora que a reunião começa
        </label>
      </Section>

      <Section title="Regras de conversa">
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <input type="checkbox" checked={c.useSpin} onChange={(e) => set("conversation", { useSpin: e.target.checked })} />
          Qualificar com SPIN (só com lead engajado)
        </label>
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <input type="checkbox" checked={c.neverDiscussManagementPrice} onChange={(e) => set("conversation", { neverDiscussManagementPrice: e.target.checked })} />
          Nunca falar preço da gestão por mensagem
        </label>
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <input type="checkbox" checked={c.dismissSellers} onChange={(e) => set("conversation", { dismissSellers: e.target.checked })} />
          Dispensar quem quer vender para a Zenite
        </label>
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <input type="checkbox" checked={c.guaranteeOnlyIfAsked} onChange={(e) => set("conversation", { guaranteeOnlyIfAsked: e.target.checked })} />
          Falar da garantia só se perguntarem
        </label>
        <div className="sm:col-span-2">
          <Field label="Regra da garantia">
            <textarea className={input} rows={2} value={c.guaranteeText} onChange={(e) => set("conversation", { guaranteeText: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Instruções extras" hint="Qualquer regra nova escrita aqui passa a valer na próxima mensagem.">
            <textarea className={input} rows={4} value={c.extraInstructions} onChange={(e) => set("conversation", { extraInstructions: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Avisos aos sócios">
        <Field label="ID do grupo do WhatsApp" hint="Se a Meta não permitir grupo, os avisos vão no privado de cada sócio.">
          <input className={input} value={n.groupId} onChange={(e) => set("notifications", { groupId: e.target.value })} />
        </Field>
        <Field label="WhatsApp dos sócios (com DDI, só números)" hint="Um por linha. Ex.: 5519999999999">
          <textarea className={input} rows={2} value={n.partnerPhones.join("\n")} onChange={(e) => set("notifications", { partnerPhones: lines(e.target.value).map((v) => v.replace(/\D/g, "")) })} />
        </Field>
        {(
          [
            ["onNewContact", "Novo contato"],
            ["onHumanRequest", "Pedido de atendimento humano"],
            ["onBooking", "Reunião agendada"],
            ["onCancellation", "Reunião desmarcada"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-[#344054]">
            <input type="checkbox" checked={n[key]} onChange={(e) => set("notifications", { [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </Section>

      <Section title="Pagamento do produto de entrada (pendente)">
        <Field label="Plataforma do link de cartão">
          <input className={input} value={payment.provider} placeholder="Ex.: Mercado Pago, InfinitePay, Asaas" onChange={(e) => set("payment", { provider: e.target.value })} />
        </Field>
        <Field label="Chave Pix">
          <input className={input} value={payment.pixKey} onChange={(e) => set("payment", { pixKey: e.target.value })} />
        </Field>
        <Field label="Confirmação do Pix">
          <select className={input} value={payment.pixConfirmation} onChange={(e) => set("payment", { pixConfirmation: e.target.value as "gateway" | "manual" })}>
            <option value="gateway">Automática pela plataforma</option>
            <option value="manual">Comprovante + sócio confirma</option>
          </select>
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={status === "saving"} className="rounded-lg bg-[#FC4C13] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D93C08] disabled:opacity-60">
          {status === "saving" ? "Salvando..." : "Salvar configurações"}
        </button>
        {status === "saved" && <span className="text-sm text-[#027A48]">Salvo.</span>}
        {status === "error" && <span className="text-sm text-[#B42318]">Não foi possível salvar.</span>}
      </div>
    </div>
  );
}
