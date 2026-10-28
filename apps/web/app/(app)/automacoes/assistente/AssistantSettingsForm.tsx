"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AssistantConfig } from "@/lib/assistant/config";

export interface ConnectionStatus {
  label: string;
  detail: string;
  ok: boolean;
  href?: string;
}

interface Props {
  initialEnabled: boolean;
  initialConfig: AssistantConfig;
  calendars: { id: string; name: string; canWrite: boolean }[];
  connections: ConnectionStatus[];
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TABS = [
  { id: "triagem", label: "Triagem", hint: "Quem vai para reunião e quem recebe o produto de entrada." },
  { id: "produto", label: "Produto de entrada", hint: "Oferta para quem está fora do perfil de cliente ideal." },
  { id: "agenda", label: "Agenda", hint: "Onde e quando a assistente marca as reuniões." },
  { id: "conversa", label: "Conversa", hint: "Regras de comportamento e instruções extras." },
  { id: "avisos", label: "Avisos", hint: "Quando e para quem a assistente avisa os sócios." },
  { id: "pagamento", label: "Pagamento", hint: "Como o produto de entrada é cobrado." },
  { id: "geral", label: "Geral", hint: "Nome, tempo de espera e modelo de IA." },
] as const;
type TabId = (typeof TABS)[number]["id"];

const inputClass = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none transition focus:border-[#FC4C13] focus:ring-2 focus:ring-[#FC4C13]/15";

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <span className="text-sm font-medium text-[#344054]">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-[#667085]">{hint}</p>}
    </div>
  );
}

function Money({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center rounded-lg border border-[#D0D5DD] bg-white focus-within:border-[#FC4C13] focus-within:ring-2 focus-within:ring-[#FC4C13]/15">
      <span className="pl-3 text-sm text-[#667085]">R$</span>
      <input className="w-full rounded-lg bg-transparent px-2 py-2 text-sm text-[#101828] outline-none" type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      {suffix && <span className="pr-3 text-xs text-[#98A2B3]">{suffix}</span>}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start justify-between gap-4 rounded-lg border border-[#EEF0F3] px-3 py-2.5 text-left transition hover:border-[#D0D5DD]">
      <span>
        <span className="block text-sm font-medium text-[#344054]">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-[#667085]">{description}</span>}
      </span>
      <span className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[#FC4C13]" : "bg-[#D0D5DD]"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Painel da assistente: status, conexões e regras em abas. Tudo vale na próxima mensagem que ela responder. */
export function AssistantSettingsForm({ initialEnabled, initialConfig, calendars, connections }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [config, setConfig] = useState(initialConfig);
  const [tab, setTab] = useState<TabId>("triagem");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set<K extends keyof AssistantConfig>(section: K, patch: Partial<AssistantConfig[K]>) {
    setConfig((current) => ({ ...current, [section]: typeof current[section] === "object" ? { ...(current[section] as object), ...patch } : patch }));
    setDirty(true);
    setStatus("idle");
  }
  const setRoot = (patch: Partial<AssistantConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setDirty(true);
    setStatus("idle");
  };
  const lines = (value: string) => value.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);

  async function persist(nextEnabled: boolean) {
    setStatus("saving");
    const response = await fetch("/api/admin/assistant-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: nextEnabled, config }) });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) {
      setDirty(false);
      router.refresh(); // atualiza o checklist de conexões, calculado no servidor
    }
    return response.ok;
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    if (!(await persist(next))) setEnabled(!next);
  }

  const ready = connections.filter((c) => c.ok).length;
  const allReady = ready === connections.length;
  const { icp, entryProduct: p, meeting: m, conversation: c, notifications: n, payment } = config;
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-6 pb-24">
      <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-[#1D1D1D] to-[#3a2218] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#FC4C13] to-[#FF8A5B] text-xl font-bold shadow-lg">{config.name.slice(0, 1)}</div>
            <div>
              <h1 className="text-lg font-semibold">{config.name}</h1>
              <p className="text-sm text-white/70">Assistente virtual do WhatsApp comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${enabled ? "bg-[#12B76A]/20 text-[#6CE9A6]" : "bg-white/10 text-white/70"}`}>
              <span className={`h-2 w-2 rounded-full ${enabled ? "bg-[#32D583]" : "bg-white/40"}`} />
              {enabled ? "Atendendo" : "Desligada"}
            </span>
            <button
              type="button"
              onClick={toggleEnabled}
              disabled={status === "saving" || (!enabled && !allReady)}
              title={!enabled && !allReady ? "Conclua as conexões antes de ligar" : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#FC4C13] text-white hover:bg-[#E8420C]"}`}
            >
              {enabled ? "Desligar" : "Ligar assistente"}
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#101828]">Conexões</h2>
            <span className="text-xs text-[#667085]">{ready} de {connections.length} prontas</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#EEF0F3]">
            <div className="h-full rounded-full bg-[#FC4C13] transition-all" style={{ width: `${(ready / connections.length) * 100}%` }} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => {
              const body = (
                <>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${conn.ok ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FFF1EB] text-[#FC4C13]"}`}>{conn.ok ? "✓" : "!"}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#101828]">{conn.label}</span>
                    <span className="block truncate text-xs text-[#667085]">{conn.detail}</span>
                  </span>
                </>
              );
              return (
                <li key={conn.label}>
                  {conn.href ? (
                    <a href={conn.href} className="flex items-center gap-3 rounded-lg border border-[#EEF0F3] p-3 transition hover:border-[#FC4C13]">{body}</a>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-[#EEF0F3] p-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white">
        <nav className="flex gap-1 overflow-x-auto border-b border-[#EEF0F3] px-3 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t.id ? "border-[#FC4C13] text-[#FC4C13]" : "border-transparent text-[#667085] hover:text-[#101828]"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-5">
          <p className="mb-5 text-sm text-[#667085]">{current.hint}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {tab === "triagem" && (
              <>
                <Field label="Verba mínima de anúncios" hint="Abaixo disso, a assistente oferece o produto de entrada.">
                  <Money value={icp.minAdBudget} onChange={(v) => set("icp", { minAdBudget: v })} suffix="/mês" />
                </Field>
                <Field label="Investimento mínimo na gestão">
                  <Money value={icp.minManagementFee} onChange={(v) => set("icp", { minManagementFee: v })} suffix="/mês" />
                </Field>
                <Field label="Região preferida">
                  <input className={inputClass} value={icp.preferredRegion} onChange={(e) => set("icp", { preferredRegion: e.target.value })} />
                </Field>
                <div className="self-end">
                  <Toggle checked={icp.preferPhysicalBusiness} onChange={(v) => set("icp", { preferPhysicalBusiness: v })} label="Preferência por negócio físico" />
                </div>
                <Field label="Observações do perfil" wide>
                  <textarea className={inputClass} rows={3} value={icp.notes} onChange={(e) => set("icp", { notes: e.target.value })} />
                </Field>
              </>
            )}

            {tab === "produto" && (
              <>
                <Field label="Nome do produto">
                  <input className={inputClass} value={p.name} onChange={(e) => set("entryProduct", { name: e.target.value })} />
                </Field>
                <Field label="Prazo de entrega" hint="Dias úteis depois do pagamento confirmado.">
                  <input className={inputClass} type="number" min={1} value={p.deliveryBusinessDays} onChange={(e) => set("entryProduct", { deliveryBusinessDays: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="Preço no cartão">
                  <Money value={p.priceCard} onChange={(v) => set("entryProduct", { priceCard: v })} />
                </Field>
                <Field label="Parcelas sem juros">
                  <input className={inputClass} type="number" min={1} max={12} value={p.maxInstallments} onChange={(e) => set("entryProduct", { maxInstallments: Number(e.target.value) || 1 })} />
                </Field>
                <Field label="Preço no Pix" hint={p.priceCard > 0 ? `Desconto de ${Math.round((1 - p.pricePix / p.priceCard) * 100)}% sobre o cartão.` : undefined}>
                  <Money value={p.pricePix} onChange={(v) => set("entryProduct", { pricePix: v })} />
                </Field>
                <Field label="Verba de anúncio sugerida" hint="Só uma indicação: quem decide é o cliente.">
                  <Money value={p.suggestedAdBudget} onChange={(v) => set("entryProduct", { suggestedAdBudget: v })} suffix="/mês" />
                </Field>
                <Field label="O que é o produto" wide>
                  <textarea className={inputClass} rows={4} value={p.description} onChange={(e) => set("entryProduct", { description: e.target.value })} />
                </Field>
                <Field label="Como funciona o ensino" wide>
                  <textarea className={inputClass} rows={2} value={p.training} onChange={(e) => set("entryProduct", { training: e.target.value })} />
                </Field>
              </>
            )}

            {tab === "agenda" && (
              <>
                <Field label="Como a reunião é apresentada" wide>
                  <textarea className={inputClass} rows={2} value={m.pitch} onChange={(e) => set("meeting", { pitch: e.target.value })} />
                </Field>
                {calendars.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#FDA29B] bg-[#FEF3F2] p-4 text-sm text-[#B42318] sm:col-span-2">Conecte o Google Agenda em Conexões para escolher as agendas.</div>
                ) : (
                  <>
                    <Field label="Agenda onde a reunião é criada">
                      <select className={inputClass} value={m.targetCalendarId} onChange={(e) => set("meeting", { targetCalendarId: e.target.value })}>
                        <option value="">Selecione</option>
                        {calendars.filter((cal) => cal.canWrite).map((cal) => (
                          <option key={cal.id} value={cal.id}>{cal.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Convidados (e-mails dos sócios)" hint="Um por linha.">
                      <textarea className={inputClass} rows={2} value={m.attendeeEmails.join("\n")} onChange={(e) => set("meeting", { attendeeEmails: lines(e.target.value) })} />
                    </Field>
                    <Field label="Agendas checadas para ver se o horário está livre" hint="Marque todas que têm compromissos dos sócios." wide>
                      <div className="flex flex-wrap gap-2">
                        {calendars.map((cal) => {
                          const on = m.calendarIds.includes(cal.id);
                          return (
                            <button
                              key={cal.id}
                              type="button"
                              onClick={() => set("meeting", { calendarIds: on ? m.calendarIds.filter((id) => id !== cal.id) : [...m.calendarIds, cal.id] })}
                              className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-[#FC4C13] bg-[#FFF1EB] text-[#C2410C]" : "border-[#D0D5DD] text-[#667085] hover:border-[#98A2B3]"}`}
                            >
                              {on ? "✓ " : ""}
                              {cal.name}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </>
                )}
                <Field label="Dias permitidos" wide>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((label, day) => {
                      const on = m.weekdays.includes(day);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => set("meeting", { weekdays: on ? m.weekdays.filter((d) => d !== day) : [...m.weekdays, day].sort() })}
                          className={`h-9 w-12 rounded-lg border text-sm font-medium transition ${on ? "border-[#FC4C13] bg-[#FC4C13] text-white" : "border-[#D0D5DD] text-[#667085] hover:border-[#98A2B3]"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Manhã">
                  <div className="flex items-center gap-2">
                    <input className={inputClass} type="time" value={m.morning.start} onChange={(e) => set("meeting", { morning: { ...m.morning, start: e.target.value } })} />
                    <span className="text-sm text-[#98A2B3]">até</span>
                    <input className={inputClass} type="time" value={m.morning.end} onChange={(e) => set("meeting", { morning: { ...m.morning, end: e.target.value } })} />
                  </div>
                </Field>
                <Field label="Tarde">
                  <div className="flex items-center gap-2">
                    <input className={inputClass} type="time" value={m.afternoon.start} onChange={(e) => set("meeting", { afternoon: { ...m.afternoon, start: e.target.value } })} />
                    <span className="text-sm text-[#98A2B3]">até</span>
                    <input className={inputClass} type="time" value={m.afternoon.end} onChange={(e) => set("meeting", { afternoon: { ...m.afternoon, end: e.target.value } })} />
                  </div>
                </Field>
                <Field label="Duração da reunião (minutos)">
                  <input className={inputClass} type="number" min={15} step={15} value={m.durationMinutes} onChange={(e) => set("meeting", { durationMinutes: Number(e.target.value) || 30 })} />
                </Field>
                <Field label="Lembrete antes da reunião (horas)" hint="Com os botões Confirmar e Desmarcar.">
                  <input className={inputClass} type="number" min={1} value={config.reminders.confirmHoursBefore} onChange={(e) => set("reminders", { confirmHoursBefore: Number(e.target.value) || 1 })} />
                </Field>
                <Field label="Pedir ok dos sócios se faltar menos de (horas)">
                  <input className={inputClass} type="number" min={0} value={m.partnerApprovalUnderHours} onChange={(e) => set("meeting", { partnerApprovalUnderHours: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="Prazo para os sócios responderem (minutos)">
                  <input className={inputClass} type="number" min={5} value={m.partnerApprovalTimeoutMinutes} onChange={(e) => set("meeting", { partnerApprovalTimeoutMinutes: Number(e.target.value) || 30 })} />
                </Field>
                <Toggle checked={m.saturdayMorningOnly} onChange={(v) => set("meeting", { saturdayMorningOnly: v })} label="Sábado só de manhã" />
                <Toggle checked={m.preferMorning} onChange={(v) => set("meeting", { preferMorning: v })} label="Oferecer manhã primeiro" description="Tarde só se o cliente não puder de manhã." />
                <Toggle checked={config.reminders.sendStartNotice} onChange={(v) => set("reminders", { sendStartNotice: v })} label="Avisar na hora que a reunião começa" description="Mensagem com o link do Meet no horário marcado." />
              </>
            )}

            {tab === "conversa" && (
              <>
                <Toggle checked={c.useSpin} onChange={(v) => set("conversation", { useSpin: v })} label="Qualificar com SPIN" description="Só com lead engajado. Resposta curta corta direto para o agendamento." />
                <Toggle checked={c.neverDiscussManagementPrice} onChange={(v) => set("conversation", { neverDiscussManagementPrice: v })} label="Nunca falar preço da gestão" description="Valor e orçamento só na reunião." />
                <Toggle checked={c.dismissSellers} onChange={(v) => set("conversation", { dismissSellers: v })} label="Dispensar quem quer vender" description="Fornecedores, agências e ferramentas." />
                <Toggle checked={c.guaranteeOnlyIfAsked} onChange={(v) => set("conversation", { guaranteeOnlyIfAsked: v })} label="Garantia só se perguntarem" />
                <Field label="Regra da garantia" wide>
                  <textarea className={inputClass} rows={2} value={c.guaranteeText} onChange={(e) => set("conversation", { guaranteeText: e.target.value })} />
                </Field>
                <Field label="Instruções extras" hint="Qualquer regra nova escrita aqui passa a valer na próxima mensagem." wide>
                  <textarea className={inputClass} rows={5} placeholder="Ex.: Em feriados, avise que a reunião pode ser no próximo dia útil." value={c.extraInstructions} onChange={(e) => set("conversation", { extraInstructions: e.target.value })} />
                </Field>
              </>
            )}

            {tab === "avisos" && (
              <>
                <Field label="ID do grupo do WhatsApp" hint="Se a Meta não permitir grupo, os avisos vão no privado de cada sócio.">
                  <input className={inputClass} value={n.groupId} onChange={(e) => set("notifications", { groupId: e.target.value })} />
                </Field>
                <Field label="WhatsApp dos sócios" hint="Um por linha, com DDI. Ex.: 5519999999999">
                  <textarea className={inputClass} rows={2} value={n.partnerPhones.join("\n")} onChange={(e) => set("notifications", { partnerPhones: lines(e.target.value).map((v) => v.replace(/\D/g, "")) })} />
                </Field>
                <Toggle checked={n.onNewContact} onChange={(v) => set("notifications", { onNewContact: v })} label="Novo contato" />
                <Toggle checked={n.onHumanRequest} onChange={(v) => set("notifications", { onHumanRequest: v })} label="Pedido de atendimento humano" />
                <Toggle checked={n.onBooking} onChange={(v) => set("notifications", { onBooking: v })} label="Reunião agendada" />
                <Toggle checked={n.onCancellation} onChange={(v) => set("notifications", { onCancellation: v })} label="Reunião desmarcada" />
              </>
            )}

            {tab === "pagamento" && (
              <>
                <div className="rounded-lg border border-[#FEDF89] bg-[#FFFAEB] p-3 text-sm text-[#B54708] sm:col-span-2">Enquanto não estiver configurado, a assistente avisa os sócios para enviarem o link ou a chave Pix.</div>
                <Field label="Plataforma do link de cartão">
                  <input className={inputClass} value={payment.provider} placeholder="Ex.: Mercado Pago, InfinitePay, Asaas" onChange={(e) => set("payment", { provider: e.target.value })} />
                </Field>
                <Field label="Chave Pix">
                  <input className={inputClass} value={payment.pixKey} onChange={(e) => set("payment", { pixKey: e.target.value })} />
                </Field>
                <Field label="Confirmação do Pix">
                  <select className={inputClass} value={payment.pixConfirmation} onChange={(e) => set("payment", { pixConfirmation: e.target.value as "gateway" | "manual" })}>
                    <option value="gateway">Automática pela plataforma</option>
                    <option value="manual">Comprovante + sócio confirma</option>
                  </select>
                </Field>
              </>
            )}

            {tab === "geral" && (
              <>
                <Field label="Nome da assistente">
                  <input className={inputClass} value={config.name} onChange={(e) => setRoot({ name: e.target.value })} />
                </Field>
                <Field label="Espera antes de responder (segundos)" hint="Conta a partir da última mensagem da pessoa.">
                  <input className={inputClass} type="number" min={30} value={config.replyDelaySeconds} onChange={(e) => setRoot({ replyDelaySeconds: Number(e.target.value) || 120 })} />
                </Field>
                <Field label="Modelo de IA">
                  <input className={inputClass} value={config.model} onChange={(e) => setRoot({ model: e.target.value })} />
                </Field>
              </>
            )}
          </div>
        </div>
      </section>

      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-[#E4E7EC] bg-white/95 backdrop-blur transition-transform ${dirty || status === "saved" || status === "error" ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-[#667085]">
            {status === "saved" ? "Configurações salvas." : status === "error" ? "Não foi possível salvar. Tente de novo." : "Você tem alterações não salvas."}
          </span>
          <div className="flex gap-2">
            {dirty && (
              <button type="button" onClick={() => { setConfig(initialConfig); setDirty(false); }} className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]">
                Descartar
              </button>
            )}
            <button type="button" onClick={() => persist(enabled)} disabled={!dirty || status === "saving"} className="rounded-lg bg-[#FC4C13] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E8420C] disabled:opacity-50">
              {status === "saving" ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
