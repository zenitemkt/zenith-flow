"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Clock, CornerDownRight, GitBranch, Link2, MessageSquare, MessageSquareText, Tag, Trash2, UserCheck } from "lucide-react";
import { FLOW_LIMITS, renderTemplate, type FlowStep, type FlowStepType } from "@/lib/instagram-flow-model";

const inputClass = "h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";
const selectClass = `${inputClass} pr-8`;
const labelClass = "flex flex-col gap-1.5 text-xs font-medium text-[#475467]";
const hintClass = "text-xs font-normal text-[#98A2B3]";
const ghostButton = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]";
const iconButton = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#98A2B3] hover:border-[#FF2B00] hover:text-[#FF2B00]";

/** Cor e ícone por tipo — só tons que o tema escuro do app já remapeia (zenite-theme.css). */
const STEP_META: Record<FlowStepType, { label: string; description: string; icon: typeof MessageSquare; badge: string }> = {
  message: { label: "Mensagem", description: "Texto, botões de link ou respostas rápidas", icon: MessageSquare, badge: "bg-[#FFF1EC] text-[#C2270A]" },
  delay: { label: "Atraso", description: "Espera um tempo antes de seguir", icon: Clock, badge: "bg-[#FEF3C7] text-[#92600A]" },
  input: { label: "Pergunta", description: "Espera a resposta e salva no contato", icon: MessageSquareText, badge: "bg-[#EEF2FF] text-[#2859B8]" },
  tag: { label: "Etiqueta", description: "Marca o contato pra filtrar depois", icon: Tag, badge: "bg-[#DCFCE7] text-[#166534]" },
  follows: { label: "Segue o perfil?", description: "Caminho diferente pra quem segue", icon: UserCheck, badge: "bg-[#EDE9FE] text-[#3730A3]" },
};

function newId(): string {
  return `s${Math.random().toString(36).slice(2, 8)}`;
}

export function messageStep(text = "", buttons: Array<{ text: string; url: string }> = []): FlowStep {
  return { id: newId(), type: "message", text, buttons, quickReplies: [], typing: true, next: null };
}

function defaultStep(type: FlowStepType, id = newId()): FlowStep {
  switch (type) {
    case "message":
      return { ...messageStep(), id };
    case "delay":
      return { id, type, seconds: 60, next: null };
    case "input":
      return { id, type, saveAs: null, validate: "any", retryText: null, branches: [], next: null, timeoutMinutes: null, timeoutNext: null };
    case "tag":
      return { id, type, add: [], remove: [], next: null };
    case "follows":
      return { id, type, yes: null, no: null };
  }
}

function formatDuration(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

function stepSummary(step: FlowStep): string {
  switch (step.type) {
    case "message":
      return step.text ? `"${step.text.replace(/\s+/g, " ").slice(0, 40)}${step.text.length > 40 ? "…" : ""}"` : "Mensagem vazia";
    case "delay":
      return `Esperar ${formatDuration(step.seconds)}`;
    case "input":
      return step.saveAs ? `Salva em "${step.saveAs}"` : "Espera a resposta";
    case "tag": {
      const add = step.add.map((t) => t.trim()).filter(Boolean);
      return add.length ? `+ ${add.join(", ")}` : "Sem etiqueta definida";
    }
    case "follows":
      return "Confere se segue o perfil";
  }
}

/** Para onde o passo vai depois — mostrado no conector entre os cartões. */
function exitsOf(step: FlowStep): Array<{ label: string; next: string | null }> {
  switch (step.type) {
    case "message":
      if (step.quickReplies.length > 0) return step.quickReplies.map((q) => ({ label: q.title || "opção", next: q.next }));
      return [{ label: "depois", next: step.next }];
    case "input":
      return [...step.branches.map((b) => ({ label: b.keywords.filter((k) => k.trim()).join(", ") || "palavra", next: b.next })), { label: step.branches.length ? "outra resposta" : "depois", next: step.next }];
    case "follows":
      return [
        { label: "segue", next: step.yes },
        { label: "não segue", next: step.no },
      ];
    default:
      return [{ label: "depois", next: step.next }];
  }
}

/** Passo que segue sozinho pro próximo — ao adicionar um passo novo, ele já fica ligado no anterior. */
function linksLinearly(step: FlowStep): boolean {
  return (step.type === "message" && step.quickReplies.length === 0) || step.type === "delay" || step.type === "tag";
}

function StepOptions({ steps, selfId }: { steps: FlowStep[]; selfId: string }) {
  return (
    <>
      <option value="">Encerrar a sequência</option>
      {steps.map((step, index) =>
        step.id === selfId ? null : (
          <option key={step.id} value={step.id}>
            Passo {index + 1} · {STEP_META[step.type].label} · {stepSummary(step)}
          </option>
        ),
      )}
    </>
  );
}

function NextSelect({ label, value, steps, selfId, onChange }: { label: string; value: string | null; steps: FlowStep[]; selfId: string; onChange: (next: string | null) => void }) {
  return (
    <label className={labelClass}>
      <span className="inline-flex items-center gap-1.5">
        <CornerDownRight size={13} aria-hidden /> {label}
      </span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={selectClass}>
        <StepOptions steps={steps} selfId={selfId} />
      </select>
    </label>
  );
}

/** Lista separada por vírgula que não come a vírgula enquanto a pessoa digita (a API limpa os vazios). */
function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  return <input value={value.join(",")} onChange={(e) => onChange(e.target.value.split(","))} placeholder={placeholder} className={inputClass} />;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string; icon?: ReactNode }>; onChange: (value: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${
            value === option.value ? "bg-white text-[#FF2B00] shadow-sm" : "text-[#667085] hover:text-[#101828]"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FlowEditor({ steps, onChange, triggerType }: { steps: FlowStep[]; onChange: (steps: FlowStep[]) => void; triggerType: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(steps.slice(1).map((s) => s.id)));

  function update(id: string, patch: Partial<FlowStep>) {
    onChange(steps.map((step) => (step.id === id ? ({ ...step, ...patch } as FlowStep) : step)));
  }

  function changeType(step: FlowStep, type: FlowStepType) {
    onChange(steps.map((s) => (s.id === step.id ? defaultStep(type, step.id) : s)));
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(id: string) {
    const clear = (value: string | null) => (value === id ? null : value);
    onChange(
      steps
        .filter((step) => step.id !== id)
        .map((step) => {
          switch (step.type) {
            case "message":
              return { ...step, next: clear(step.next), quickReplies: step.quickReplies.map((q) => ({ ...q, next: clear(q.next) })) };
            case "input":
              return { ...step, next: clear(step.next), timeoutNext: clear(step.timeoutNext), branches: step.branches.map((b) => ({ ...b, next: clear(b.next) })) };
            case "follows":
              return { ...step, yes: clear(step.yes), no: clear(step.no) };
            default:
              return { ...step, next: clear(step.next) };
          }
        }),
    );
  }

  function add(type: FlowStepType) {
    const created = defaultStep(type);
    const last = steps[steps.length - 1];
    const linked = last && linksLinearly(last) && !("next" in last && last.next) ? steps.map((s) => (s.id === last.id ? ({ ...s, next: created.id } as FlowStep) : s)) : steps;
    // O novo abre, os outros fecham — a tela não vira um paredão de campos.
    setCollapsed(new Set(linked.map((s) => s.id)));
    onChange([...linked, created]);
  }

  const indexOf = (id: string | null) => (id ? steps.findIndex((s) => s.id === id) : -1);

  return (
    <div className="flex flex-col">
      {triggerType === "comment" && steps.length > 1 && (
        <p className="mb-3 rounded-lg border border-[#F9C7B4] bg-[#FFF7F5] p-3 text-xs text-[#C2270A]">
          No comentário, a 1ª mensagem sai como resposta privada. A Meta só libera as próximas depois que a pessoa responder, então a sequência espera essa
          resposta sozinha. Respostas rápidas na 1ª mensagem ajudam a pessoa a responder.
        </p>
      )}

      {steps.map((step, index) => {
        const meta = STEP_META[step.type];
        const Icon = meta.icon;
        const isOpen = !collapsed.has(step.id);
        const exits = exitsOf(step);
        return (
          <div key={step.id} className="flex flex-col">
            <div className={`rounded-xl border bg-white ${isOpen ? "border-[#D0D5DD] shadow-sm" : "border-[#E4E7EC]"}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.badge}`}>
                  <Icon size={17} aria-hidden />
                </span>
                <button type="button" onClick={() => toggle(step.id)} className="flex min-w-0 flex-1 flex-col items-start text-left">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                    Passo {index + 1}
                    {index === 0 ? " · primeira mensagem" : ""}
                  </span>
                  <span className="w-full truncate text-sm font-semibold text-[#101828]">
                    {meta.label}
                    <span className="ml-2 font-normal text-[#667085]">{stepSummary(step)}</span>
                  </span>
                </button>
                {index > 0 && isOpen && (
                  <select
                    value={step.type}
                    onChange={(e) => changeType(step, e.target.value as FlowStepType)}
                    className="h-8 rounded-lg border border-[#D0D5DD] bg-white px-2 text-xs text-[#344054]"
                    aria-label="Tipo do passo"
                  >
                    {(Object.keys(STEP_META) as FlowStepType[]).map((type) => (
                      <option key={type} value={type}>
                        {STEP_META[type].label}
                      </option>
                    ))}
                  </select>
                )}
                {index > 0 && (
                  <button type="button" onClick={() => remove(step.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#98A2B3] hover:bg-[#FEE4E2] hover:text-[#B42318]" aria-label="Remover passo">
                    <Trash2 size={15} aria-hidden />
                  </button>
                )}
                <button type="button" onClick={() => toggle(step.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]" aria-label={isOpen ? "Recolher" : "Abrir"}>
                  <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-[#EEF0F3] px-4 py-4">
                  {step.type === "message" && <MessageStepFields step={step} steps={steps} update={update} />}

                  {step.type === "delay" && (
                    <div className="flex flex-col gap-3">
                      <DelayInput seconds={step.seconds} onChange={(seconds) => update(step.id, { seconds })} />
                      <p className={hintClass}>
                        Até {FLOW_LIMITS.inlineDelaySeconds} segundos sai na hora. Acima disso, sai no minuto seguinte ao prazo. Máximo de 23 horas (janela de 24h da
                        Meta).
                      </p>
                      <NextSelect label="Depois do atraso" value={step.next} steps={steps} selfId={step.id} onChange={(next) => update(step.id, { next })} />
                    </div>
                  )}

                  {step.type === "input" && <InputStepFields step={step} steps={steps} update={update} />}

                  {step.type === "tag" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className={labelClass}>
                        Adicionar etiquetas
                        <ListInput value={step.add} onChange={(add) => update(step.id, { add })} placeholder="lead quente, quer orçamento" />
                        <span className={hintClass}>Separe por vírgula.</span>
                      </label>
                      <label className={labelClass}>
                        Tirar etiquetas
                        <ListInput value={step.remove} onChange={(remove) => update(step.id, { remove })} placeholder="frio" />
                      </label>
                      <div className="md:col-span-2">
                        <NextSelect label="Depois" value={step.next} steps={steps} selfId={step.id} onChange={(next) => update(step.id, { next })} />
                      </div>
                    </div>
                  )}

                  {step.type === "follows" && (
                    <div className="flex flex-col gap-3">
                      <p className={hintClass}>Confere na Meta se a pessoa segue o perfil do cliente e escolhe o caminho.</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <NextSelect label="Se segue" value={step.yes} steps={steps} selfId={step.id} onChange={(yes) => update(step.id, { yes })} />
                        <NextSelect label="Se não segue" value={step.no} steps={steps} selfId={step.id} onChange={(no) => update(step.id, { no })} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Conector: mostra pra onde cada saída do passo vai. */}
            <div className="ml-[33px] flex flex-col gap-1 border-l-2 border-dashed border-[#E4E7EC] py-2 pl-5">
              {exits.map((exit, i) => {
                const target = indexOf(exit.next);
                return (
                  <span key={i} className="inline-flex flex-wrap items-center gap-1.5 text-xs text-[#667085]">
                    {exits.length > 1 && <GitBranch size={12} aria-hidden />}
                    {exits.length > 1 && <span className="font-medium text-[#475467]">{exit.label}</span>}
                    <span>→</span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${target >= 0 ? "bg-[#F2F4F7] text-[#344054]" : "text-[#98A2B3]"}`}>
                      {target >= 0 ? `Passo ${target + 1}` : "encerra"}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      {steps.length < FLOW_LIMITS.steps && (
        <div className="rounded-xl border border-dashed border-[#D0D5DD] p-3">
          <p className="mb-2 text-xs font-semibold text-[#475467]">Adicionar passo</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(STEP_META) as FlowStepType[]).map((type) => {
              const meta = STEP_META[type];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => add(type)}
                  className="flex items-center gap-3 rounded-lg border border-[#E4E7EC] bg-white p-2.5 text-left hover:border-[#FF2B00]"
                >
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.badge}`}>
                    <Icon size={15} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#101828]">{meta.label}</span>
                    <span className="block truncate text-xs text-[#667085]">{meta.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageStepFields({ step, steps, update }: { step: Extract<FlowStep, { type: "message" }>; steps: FlowStep[]; update: (id: string, patch: Partial<FlowStep>) => void }) {
  const mode = step.quickReplies.length > 0 ? "quick" : step.buttons.length > 0 ? "buttons" : "none";
  return (
    <div className="flex flex-col gap-4">
      <label className={labelClass}>
        Texto da mensagem
        <textarea
          value={step.text}
          onChange={(e) => update(step.id, { text: e.target.value })}
          rows={6}
          className="min-h-[140px] w-full resize-y rounded-lg border border-[#D0D5DD] bg-white p-3 text-sm leading-relaxed text-[#101828] outline-none focus:border-[#FF2B00]"
        />
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={hintClass}>Inserir:</span>
          {["primeiro_nome", "nome", "usuario"].map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => update(step.id, { text: `${step.text}{{${variable}}}` })}
              className="rounded-md bg-[#F2F4F7] px-2 py-0.5 font-mono text-[11px] text-[#344054] hover:bg-[#FFF1EC] hover:text-[#FF2B00]"
            >
              {`{{${variable}}}`}
            </button>
          ))}
          <span className={hintClass}>ou um campo salvo numa pergunta, como {"{{email}}"}.</span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-[#F9FAFB] p-3">
        <input type="checkbox" checked={step.typing} onChange={(e) => update(step.id, { typing: e.target.checked })} className="mt-0.5 accent-[#FF2B00]" />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-[#344054]">Atraso inteligente</span>
          <span className={hintClass}>Mostra &ldquo;digitando...&rdquo; antes de enviar, pelo tempo de leitura do texto (1 a 4 segundos).</span>
        </span>
      </label>

      <div className="flex flex-col gap-3">
        <Segmented
          value={mode}
          onChange={(value) => {
            if (value === "none") update(step.id, { buttons: [], quickReplies: [] });
            if (value === "buttons") update(step.id, { quickReplies: [], buttons: step.buttons.length ? step.buttons : [{ text: "", url: "" }] });
            if (value === "quick") update(step.id, { buttons: [], quickReplies: step.quickReplies.length ? step.quickReplies : [{ title: "", next: null }] });
          }}
          options={[
            { value: "none", label: "Só texto" },
            { value: "buttons", label: "Botões de link", icon: <Link2 size={13} aria-hidden /> },
            { value: "quick", label: "Respostas rápidas", icon: <GitBranch size={13} aria-hidden /> },
          ]}
        />

        {mode === "buttons" && (
          <div className="flex flex-col gap-2">
            {step.buttons.map((button, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                <input
                  value={button.text}
                  onChange={(e) => update(step.id, { buttons: step.buttons.map((b, j) => (j === i ? { ...b, text: e.target.value } : b)) })}
                  placeholder="Texto do botão (até 20)"
                  maxLength={20}
                  className={inputClass}
                />
                <input
                  value={button.url}
                  onChange={(e) => update(step.id, { buttons: step.buttons.map((b, j) => (j === i ? { ...b, url: e.target.value } : b)) })}
                  placeholder="https://..."
                  className={inputClass}
                />
                <button type="button" onClick={() => update(step.id, { buttons: step.buttons.filter((_, j) => j !== i) })} className={iconButton} aria-label="Remover botão">
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            ))}
            {step.buttons.length < FLOW_LIMITS.buttons && (
              <button type="button" onClick={() => update(step.id, { buttons: [...step.buttons, { text: "", url: "" }] })} className={`${ghostButton} self-start`}>
                + Adicionar botão
              </button>
            )}
            <p className={hintClass}>Os cliques são contados nas métricas. Até {FLOW_LIMITS.buttons} botões.</p>
          </div>
        )}

        {mode === "quick" && (
          <div className="flex flex-col gap-2">
            <p className={hintClass}>Cada opção vira um botão que some depois do toque. A sequência espera a escolha e segue pelo caminho dela.</p>
            {step.quickReplies.map((reply, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                <input
                  value={reply.title}
                  onChange={(e) => update(step.id, { quickReplies: step.quickReplies.map((q, j) => (j === i ? { ...q, title: e.target.value } : q)) })}
                  placeholder="Opção (até 20)"
                  maxLength={20}
                  className={inputClass}
                />
                <select
                  value={reply.next ?? ""}
                  onChange={(e) => update(step.id, { quickReplies: step.quickReplies.map((q, j) => (j === i ? { ...q, next: e.target.value || null } : q)) })}
                  className={selectClass}
                  aria-label="Vai para"
                >
                  <StepOptions steps={steps} selfId={step.id} />
                </select>
                <button type="button" onClick={() => update(step.id, { quickReplies: step.quickReplies.filter((_, j) => j !== i) })} className={iconButton} aria-label="Remover opção">
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            ))}
            {step.quickReplies.length < FLOW_LIMITS.quickReplies && (
              <button type="button" onClick={() => update(step.id, { quickReplies: [...step.quickReplies, { title: "", next: null }] })} className={`${ghostButton} self-start`}>
                + Adicionar opção
              </button>
            )}
          </div>
        )}
      </div>

      {(steps.length > 1 || mode === "quick") && (
        <NextSelect
          label={mode === "quick" ? "Se a pessoa digitar outra coisa" : "Depois desta mensagem"}
          value={step.next}
          steps={steps}
          selfId={step.id}
          onChange={(next) => update(step.id, { next })}
        />
      )}
    </div>
  );
}

function InputStepFields({ step, steps, update }: { step: Extract<FlowStep, { type: "input" }>; steps: FlowStep[]; update: (id: string, patch: Partial<FlowStep>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-[#EEF2FF] p-3 text-xs text-[#2859B8]">Espera a pessoa responder a mensagem anterior. Escreva a pergunta no passo de mensagem logo antes deste.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={labelClass}>
          Salvar a resposta no campo
          <input value={step.saveAs ?? ""} onChange={(e) => update(step.id, { saveAs: e.target.value || null })} placeholder="email, telefone, cidade..." className={inputClass} />
          <span className={hintClass}>Opcional. Depois dá pra usar como {"{{campo}}"} nas mensagens.</span>
        </label>
        <label className={labelClass}>
          Tipo de resposta esperada
          <select value={step.validate} onChange={(e) => update(step.id, { validate: e.target.value as typeof step.validate })} className={selectClass}>
            <option value="any">Qualquer texto</option>
            <option value="email">E-mail</option>
            <option value="phone">Telefone</option>
            <option value="number">Número</option>
          </select>
        </label>
      </div>
      {step.validate !== "any" && (
        <label className={labelClass}>
          Mensagem quando a resposta não vale
          <input
            value={step.retryText ?? ""}
            onChange={(e) => update(step.id, { retryText: e.target.value || null })}
            placeholder="Não consegui entender, pode mandar de novo?"
            className={inputClass}
          />
        </label>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-[#EEF0F3] p-3">
        <p className="text-xs font-semibold text-[#475467]">Caminhos pela resposta</p>
        <p className={hintClass}>Opcional. Se a resposta tiver uma das palavras, segue pelo passo escolhido.</p>
        {step.branches.map((branch, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
            <ListInput
              value={branch.keywords}
              onChange={(keywords) => update(step.id, { branches: step.branches.map((b, j) => (j === i ? { ...b, keywords } : b)) })}
              placeholder="preço, valor"
            />
            <select
              value={branch.next ?? ""}
              onChange={(e) => update(step.id, { branches: step.branches.map((b, j) => (j === i ? { ...b, next: e.target.value || null } : b)) })}
              className={selectClass}
              aria-label="Vai para"
            >
              <StepOptions steps={steps} selfId={step.id} />
            </select>
            <button type="button" onClick={() => update(step.id, { branches: step.branches.filter((_, j) => j !== i) })} className={iconButton} aria-label="Remover caminho">
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        ))}
        {step.branches.length < FLOW_LIMITS.branches && (
          <button type="button" onClick={() => update(step.id, { branches: [...step.branches, { keywords: [], next: null }] })} className={`${ghostButton} self-start`}>
            + Adicionar caminho
          </button>
        )}
      </div>

      <NextSelect
        label={step.branches.length ? "Se não tiver nenhuma dessas palavras" : "Depois da resposta"}
        value={step.next}
        steps={steps}
        selfId={step.id}
        onChange={(next) => update(step.id, { next })}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <label className={labelClass}>
          Desistir depois de (minutos)
          <input
            type="number"
            min={1}
            value={step.timeoutMinutes ?? ""}
            onChange={(e) => update(step.id, { timeoutMinutes: e.target.value ? Number(e.target.value) : null })}
            placeholder="Sem limite (até 24h)"
            className={inputClass}
          />
        </label>
        {step.timeoutMinutes ? (
          <NextSelect label="Se não responder a tempo" value={step.timeoutNext} steps={steps} selfId={step.id} onChange={(timeoutNext) => update(step.id, { timeoutNext })} />
        ) : null}
      </div>
    </div>
  );
}

const UNITS = [
  { label: "segundos", seconds: 1 },
  { label: "minutos", seconds: 60 },
  { label: "horas", seconds: 3600 },
];

function DelayInput({ seconds, onChange }: { seconds: number; onChange: (seconds: number) => void }) {
  const unit = seconds % 3600 === 0 ? UNITS[2]! : seconds % 60 === 0 ? UNITS[1]! : UNITS[0]!;
  const amount = seconds / unit.seconds;
  return (
    <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
      <input type="number" min={1} value={amount} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1) * unit.seconds)} className={inputClass} aria-label="Quantidade" />
      <select value={unit.label} onChange={(e) => onChange(amount * (UNITS.find((u) => u.label === e.target.value)?.seconds ?? 1))} className={selectClass} aria-label="Unidade">
        {UNITS.map((u) => (
          <option key={u.label} value={u.label}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prévia
// ---------------------------------------------------------------------------

const PREVIEW_CONTACT = { name: "Ana Souza", username: "ana.souza", fields: { email: "ana@email.com", telefone: "19999990000" } };

/**
 * Como a conversa aparece pra pessoa, seguindo o caminho principal: em
 * resposta rápida segue a 1ª opção, em pergunta segue o "depois", em "segue
 * o perfil?" segue o "sim".
 */
export function FlowPreview({ steps, username }: { steps: FlowStep[]; username: string | null }) {
  const items: ReactNode[] = [];
  const visited = new Set<string>();
  let current: FlowStep | undefined = steps[0];
  while (current && !visited.has(current.id) && items.length < 14) {
    visited.add(current.id);
    const step: FlowStep = current;
    let nextId: string | null = null;
    if (step.type === "message") {
      items.push(
        <div key={step.id} className="flex max-w-[85%] flex-col gap-1 self-start">
          <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[#F2F4F7] px-3 py-2 text-[13px] leading-snug text-[#101828]">
            {renderTemplate(step.text, PREVIEW_CONTACT) || <span className="text-[#98A2B3]">Mensagem vazia</span>}
          </div>
          {step.buttons.map((button, i) => (
            <div key={i} className="rounded-xl border border-[#E4E7EC] bg-white px-3 py-1.5 text-center text-[13px] font-semibold text-[#2859B8]">
              {button.text || "Botão"}
            </div>
          ))}
        </div>,
      );
      if (step.quickReplies.length > 0) {
        items.push(
          <div key={`${step.id}-qr`} className="flex flex-wrap justify-end gap-1.5">
            {step.quickReplies.map((reply, i) => (
              <span key={i} className={`rounded-full border px-3 py-1 text-xs font-medium ${i === 0 ? "border-[#FF2B00] text-[#FF2B00]" : "border-[#D0D5DD] text-[#344054]"}`}>
                {reply.title || "Opção"}
              </span>
            ))}
          </div>,
        );
        const first = step.quickReplies[0]!;
        if (first.title) items.push(<UserBubble key={`${step.id}-pick`} text={first.title} />);
        nextId = first.next;
      } else {
        nextId = step.next;
      }
    } else if (step.type === "delay") {
      items.push(<PreviewNote key={step.id} text={`aguarda ${formatDuration(step.seconds)}`} />);
      nextId = step.next;
    } else if (step.type === "input") {
      items.push(<UserBubble key={step.id} text={step.saveAs ? (PREVIEW_CONTACT.fields as Record<string, string>)[step.saveAs] ?? `(${step.saveAs})` : "(resposta da pessoa)"} />);
      nextId = step.next;
    } else if (step.type === "tag") {
      const add = step.add.map((t) => t.trim()).filter(Boolean);
      if (add.length) items.push(<PreviewNote key={step.id} text={`etiqueta: ${add.join(", ")}`} />);
      nextId = step.next;
    } else {
      items.push(<PreviewNote key={step.id} text="segue o perfil? → sim" />);
      nextId = step.yes;
    }
    current = nextId ? steps.find((s) => s.id === nextId) : undefined;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[28px] border-[6px] border-[#101828] bg-white">
      <div className="flex items-center gap-2 border-b border-[#EEF0F3] px-4 py-3">
        <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#FF2B00] to-[#ff8a5c]" />
        <span className="text-sm font-semibold text-[#101828]">{username ? `@${username}` : "perfil do cliente"}</span>
      </div>
      <div className="flex min-h-[360px] flex-col gap-2 bg-white p-3">
        <UserBubble text="(mensagem com a palavra-chave)" />
        {items}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-[#FF2B00] px-3 py-2 text-[13px] leading-snug text-white">{text}</div>;
}

function PreviewNote({ text }: { text: string }) {
  return <div className="self-center rounded-full bg-[#F9FAFB] px-2.5 py-0.5 text-[11px] text-[#98A2B3]">{text}</div>;
}
