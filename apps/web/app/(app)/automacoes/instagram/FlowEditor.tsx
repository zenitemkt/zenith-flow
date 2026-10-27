"use client";

import { FLOW_LIMITS, type FlowStep, type FlowStepType } from "@/lib/instagram-flow-model";

const inputClass = "h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-[#475467]";
const smallButton = "h-8 rounded-lg border border-[#D0D5DD] px-2.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]";
const removeButton = "h-9 rounded-lg border border-[#FDA29B] px-2.5 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2]";

const STEP_LABELS: Record<FlowStepType, string> = {
  message: "Mensagem",
  delay: "Atraso",
  input: "Pergunta",
  tag: "Etiqueta",
  follows: "Segue o perfil?",
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
      return step.text ? `"${step.text.slice(0, 32)}${step.text.length > 32 ? "…" : ""}"` : "Mensagem vazia";
    case "delay":
      return `Esperar ${formatDuration(step.seconds)}`;
    case "input":
      return step.saveAs ? `Pergunta → ${step.saveAs}` : "Pergunta";
    case "tag":
      return step.add.filter(Boolean).length ? `Etiqueta ${step.add.filter(Boolean).join(", ")}` : "Etiqueta";
    case "follows":
      return "Segue o perfil?";
  }
}

/** Passo que segue sozinho pro próximo — ao adicionar um passo novo, ele já fica ligado no anterior. */
function linksLinearly(step: FlowStep): boolean {
  return (step.type === "message" && step.quickReplies.length === 0) || step.type === "delay" || step.type === "tag";
}

function NextSelect({
  label,
  value,
  steps,
  selfId,
  onChange,
}: {
  label: string;
  value: string | null;
  steps: FlowStep[];
  selfId: string;
  onChange: (next: string | null) => void;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={`${inputClass} bg-white`}>
        <option value="">Encerrar a sequência</option>
        {steps.map((step, index) =>
          step.id === selfId ? null : (
            <option key={step.id} value={step.id}>
              Passo {index + 1} · {stepSummary(step)}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

/** Lista separada por vírgula que não come a vírgula enquanto a pessoa digita (a API limpa os vazios). */
function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  return <input value={value.join(",")} onChange={(e) => onChange(e.target.value.split(","))} placeholder={placeholder} className={inputClass} />;
}

export function FlowEditor({ steps, onChange, triggerType }: { steps: FlowStep[]; onChange: (steps: FlowStep[]) => void; triggerType: string }) {
  function update(id: string, patch: Partial<FlowStep>) {
    onChange(steps.map((step) => (step.id === id ? ({ ...step, ...patch } as FlowStep) : step)));
  }

  function changeType(step: FlowStep, type: FlowStepType) {
    onChange(steps.map((s) => (s.id === step.id ? defaultStep(type, step.id) : s)));
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
    onChange([...linked, created]);
  }

  return (
    <div className="flex flex-col gap-3">
      {triggerType === "comment" && steps.length > 1 && (
        <p className="rounded-lg bg-[#FFF4ED] p-2.5 text-xs text-[#B93815]">
          No comentário, a 1ª mensagem sai como resposta privada. A Meta só libera as próximas depois que a pessoa responder, então a sequência espera essa
          resposta sozinha. Respostas rápidas na 1ª mensagem ajudam a pessoa a responder.
        </p>
      )}

      {steps.map((step, index) => (
        <div key={step.id} className="flex flex-col gap-3 rounded-lg border border-[#E4E7EC] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#FFF4F2] px-2 py-0.5 text-xs font-semibold text-[#FF2B00]">Passo {index + 1}</span>
              {index === 0 ? (
                <span className="text-xs font-semibold text-[#344054]">Primeira mensagem</span>
              ) : (
                <select value={step.type} onChange={(e) => changeType(step, e.target.value as FlowStepType)} className="h-8 rounded-lg border border-[#D0D5DD] bg-white px-2 text-xs">
                  {Object.entries(STEP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {index > 0 && (
              <button type="button" onClick={() => remove(step.id)} className="h-8 rounded-lg border border-[#FDA29B] px-2.5 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2]">
                Remover passo
              </button>
            )}
          </div>

          {step.type === "message" && <MessageStepFields step={step} steps={steps} update={update} />}

          {step.type === "delay" && (
            <div className="flex flex-col gap-2">
              <DelayInput seconds={step.seconds} onChange={(seconds) => update(step.id, { seconds })} />
              <p className="text-xs text-[#667085]">
                Até {FLOW_LIMITS.inlineDelaySeconds} s sai na hora. Acima disso, o agendador manda no minuto seguinte ao prazo. Máximo de 23 h, por causa da
                janela de 24h da Meta.
              </p>
              <NextSelect label="Depois" value={step.next} steps={steps} selfId={step.id} onChange={(next) => update(step.id, { next })} />
            </div>
          )}

          {step.type === "input" && <InputStepFields step={step} steps={steps} update={update} />}

          {step.type === "tag" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={labelClass}>
                Adicionar etiquetas (separe por vírgula)
                <ListInput value={step.add} onChange={(add) => update(step.id, { add })} placeholder="lead quente, quer orçamento" />
              </label>
              <label className={labelClass}>
                Tirar etiquetas
                <ListInput value={step.remove} onChange={(remove) => update(step.id, { remove })} placeholder="frio" />
              </label>
              <div className="sm:col-span-2">
                <NextSelect label="Depois" value={step.next} steps={steps} selfId={step.id} onChange={(next) => update(step.id, { next })} />
              </div>
            </div>
          )}

          {step.type === "follows" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-xs text-[#667085] sm:col-span-2">Confere na Meta se a pessoa segue o perfil do cliente e escolhe o caminho.</p>
              <NextSelect label="Se segue" value={step.yes} steps={steps} selfId={step.id} onChange={(yes) => update(step.id, { yes })} />
              <NextSelect label="Se não segue" value={step.no} steps={steps} selfId={step.id} onChange={(no) => update(step.id, { no })} />
            </div>
          )}
        </div>
      ))}

      {steps.length < FLOW_LIMITS.steps && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#475467]">Adicionar passo:</span>
          {(Object.keys(STEP_LABELS) as FlowStepType[]).map((type) => (
            <button key={type} type="button" onClick={() => add(type)} className={smallButton}>
              + {STEP_LABELS[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageStepFields({
  step,
  steps,
  update,
}: {
  step: Extract<FlowStep, { type: "message" }>;
  steps: FlowStep[];
  update: (id: string, patch: Partial<FlowStep>) => void;
}) {
  const mode = step.quickReplies.length > 0 ? "quick" : step.buttons.length > 0 ? "buttons" : "none";
  return (
    <div className="flex flex-col gap-3">
      <label className={labelClass}>
        Texto da mensagem
        <textarea value={step.text} onChange={(e) => update(step.id, { text: e.target.value })} rows={3} className="rounded-lg border border-[#D0D5DD] p-2.5 text-sm" />
        <span className="font-normal text-[#667085]">
          Variáveis: {"{{primeiro_nome}}"}, {"{{nome}}"}, {"{{usuario}}"} e qualquer campo salvo numa pergunta, como {"{{email}}"}.
        </span>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-[#475467]">
        <input type="checkbox" checked={step.typing} onChange={(e) => update(step.id, { typing: e.target.checked })} />
        Mostrar &ldquo;digitando...&rdquo; antes, pelo tempo de leitura do texto (atraso inteligente)
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => update(step.id, { quickReplies: [], buttons: step.buttons.length ? step.buttons : [{ text: "", url: "" }] })}
          className={`h-8 rounded-lg border px-3 text-xs font-semibold ${mode === "buttons" ? "border-[#FF2B00] bg-[#FFF4F2] text-[#FF2B00]" : "border-[#D0D5DD] text-[#344054]"}`}
        >
          Botões de link
        </button>
        <button
          type="button"
          onClick={() => update(step.id, { buttons: [], quickReplies: step.quickReplies.length ? step.quickReplies : [{ title: "", next: null }] })}
          className={`h-8 rounded-lg border px-3 text-xs font-semibold ${mode === "quick" ? "border-[#FF2B00] bg-[#FFF4F2] text-[#FF2B00]" : "border-[#D0D5DD] text-[#344054]"}`}
        >
          Respostas rápidas
        </button>
        {mode !== "none" && (
          <button type="button" onClick={() => update(step.id, { buttons: [], quickReplies: [] })} className={smallButton}>
            Só texto
          </button>
        )}
      </div>

      {mode === "buttons" && (
        <div className="flex flex-col gap-2">
          {step.buttons.map((button, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                value={button.text}
                onChange={(e) => update(step.id, { buttons: step.buttons.map((b, j) => (j === i ? { ...b, text: e.target.value } : b)) })}
                placeholder="Texto do botão"
                maxLength={20}
                className={inputClass}
              />
              <input
                value={button.url}
                onChange={(e) => update(step.id, { buttons: step.buttons.map((b, j) => (j === i ? { ...b, url: e.target.value } : b)) })}
                placeholder="Link do botão"
                className={inputClass}
              />
              <button type="button" onClick={() => update(step.id, { buttons: step.buttons.filter((_, j) => j !== i) })} className={removeButton}>
                Remover
              </button>
            </div>
          ))}
          {step.buttons.length < FLOW_LIMITS.buttons && (
            <button type="button" onClick={() => update(step.id, { buttons: [...step.buttons, { text: "", url: "" }] })} className={`${smallButton} self-start`}>
              + Adicionar botão
            </button>
          )}
        </div>
      )}

      {mode === "quick" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#667085]">Cada opção vira um botão que some depois do toque. A sequência espera a escolha e segue pelo caminho dela.</p>
          {step.quickReplies.map((reply, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <input
                value={reply.title}
                onChange={(e) => update(step.id, { quickReplies: step.quickReplies.map((q, j) => (j === i ? { ...q, title: e.target.value } : q)) })}
                placeholder="Opção (até 20 letras)"
                maxLength={20}
                className={inputClass}
              />
              <select
                value={reply.next ?? ""}
                onChange={(e) => update(step.id, { quickReplies: step.quickReplies.map((q, j) => (j === i ? { ...q, next: e.target.value || null } : q)) })}
                className={`${inputClass} bg-white`}
              >
                <option value="">Encerrar a sequência</option>
                {steps.map((s, index) =>
                  s.id === step.id ? null : (
                    <option key={s.id} value={s.id}>
                      Passo {index + 1} · {stepSummary(s)}
                    </option>
                  ),
                )}
              </select>
              <button type="button" onClick={() => update(step.id, { quickReplies: step.quickReplies.filter((_, j) => j !== i) })} className={removeButton}>
                Remover
              </button>
            </div>
          ))}
          {step.quickReplies.length < FLOW_LIMITS.quickReplies && (
            <button type="button" onClick={() => update(step.id, { quickReplies: [...step.quickReplies, { title: "", next: null }] })} className={`${smallButton} self-start`}>
              + Adicionar opção
            </button>
          )}
        </div>
      )}

      {(steps.length > 1 || mode === "quick") && (
        <NextSelect
          label={mode === "quick" ? "Se a pessoa digitar outra coisa" : "Depois"}
          value={step.next}
          steps={steps}
          selfId={step.id}
          onChange={(next) => update(step.id, { next })}
        />
      )}
    </div>
  );
}

function InputStepFields({
  step,
  steps,
  update,
}: {
  step: Extract<FlowStep, { type: "input" }>;
  steps: FlowStep[];
  update: (id: string, patch: Partial<FlowStep>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[#667085]">Espera a pessoa responder a mensagem anterior. Coloque a pergunta no passo de mensagem logo antes deste.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelClass}>
          Salvar a resposta no campo (opcional)
          <input value={step.saveAs ?? ""} onChange={(e) => update(step.id, { saveAs: e.target.value || null })} placeholder="email, telefone, cidade..." className={inputClass} />
        </label>
        <label className={labelClass}>
          Tipo de resposta esperada
          <select value={step.validate} onChange={(e) => update(step.id, { validate: e.target.value as typeof step.validate })} className={`${inputClass} bg-white`}>
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

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[#475467]">Caminhos pela resposta (opcional)</p>
        {step.branches.map((branch, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <ListInput
              value={branch.keywords}
              onChange={(keywords) => update(step.id, { branches: step.branches.map((b, j) => (j === i ? { ...b, keywords } : b)) })}
              placeholder="Se tiver: preço, valor"
            />
            <select
              value={branch.next ?? ""}
              onChange={(e) => update(step.id, { branches: step.branches.map((b, j) => (j === i ? { ...b, next: e.target.value || null } : b)) })}
              className={`${inputClass} bg-white`}
            >
              <option value="">Encerrar a sequência</option>
              {steps.map((s, index) =>
                s.id === step.id ? null : (
                  <option key={s.id} value={s.id}>
                    Passo {index + 1} · {stepSummary(s)}
                  </option>
                ),
              )}
            </select>
            <button type="button" onClick={() => update(step.id, { branches: step.branches.filter((_, j) => j !== i) })} className={removeButton}>
              Remover
            </button>
          </div>
        ))}
        {step.branches.length < FLOW_LIMITS.branches && (
          <button type="button" onClick={() => update(step.id, { branches: [...step.branches, { keywords: [], next: null }] })} className={`${smallButton} self-start`}>
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

      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelClass}>
          Desistir depois de (minutos, opcional)
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
    <div className="grid grid-cols-[1fr_1fr] gap-2 sm:max-w-sm">
      <input type="number" min={1} value={amount} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1) * unit.seconds)} className={inputClass} />
      <select value={unit.label} onChange={(e) => onChange(amount * (UNITS.find((u) => u.label === e.target.value)?.seconds ?? 1))} className={`${inputClass} bg-white`}>
        {UNITS.map((u) => (
          <option key={u.label} value={u.label}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}
