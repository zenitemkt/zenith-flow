"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONDITION_OPERATORS,
  CONDITION_OPERATOR_LABELS,
  WORKFLOW_ACTION_LABELS,
  type ConditionOperator,
  type WorkflowActionType,
  type WorkflowStep,
} from "@/lib/workflows";

type NewStepType = "CONDICAO" | "ESPERA" | "ACAO";

function summarizeStep(step: WorkflowStep): string {
  if (step.type === "CONDICAO") {
    const opLabel = CONDITION_OPERATOR_LABELS[step.operator];
    return step.operator === "exists" || step.operator === "not_exists"
      ? `Se ${step.field} ${opLabel}`
      : `Se ${step.field} ${opLabel} "${step.value}"`;
  }
  if (step.type === "ESPERA") {
    return `Esperar ${step.minutes} min`;
  }
  if (step.action === "create_task") return `Criar tarefa: ${step.title}`;
  if (step.action === "add_lead_note") return `Adicionar nota ao lead: ${step.body.slice(0, 40)}`;
  return `Chamar webhook: ${step.url}`;
}

export function DraftStepBuilder({
  workflowId,
  fields,
  initialSteps,
}: {
  workflowId: string;
  fields: string[];
  initialSteps: WorkflowStep[];
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  const [newType, setNewType] = useState<NewStepType>("CONDICAO");
  const [conditionField, setConditionField] = useState(fields[0] ?? "");
  const [conditionOperator, setConditionOperator] = useState<ConditionOperator>("eq");
  const [conditionValue, setConditionValue] = useState("");
  const [waitMinutes, setWaitMinutes] = useState("60");
  const [actionType, setActionType] = useState<WorkflowActionType>("create_task");
  const [actionTitle, setActionTitle] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [actionBody, setActionBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function addStep() {
    setError(null);
    if (newType === "CONDICAO") {
      if (!conditionField.trim()) {
        setError("Informe o campo da condição.");
        return;
      }
      setSteps((prev) => [...prev, { type: "CONDICAO", field: conditionField.trim(), operator: conditionOperator, value: conditionValue }]);
      setConditionValue("");
      return;
    }
    if (newType === "ESPERA") {
      const minutes = Number(waitMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        setError("Informe uma espera em minutos maior que zero.");
        return;
      }
      setSteps((prev) => [...prev, { type: "ESPERA", minutes }]);
      return;
    }
    // ACAO
    if (actionType === "create_task") {
      if (!actionTitle.trim()) {
        setError("Informe o título da tarefa.");
        return;
      }
      setSteps((prev) => [...prev, { type: "ACAO", action: "create_task", title: actionTitle.trim(), description: actionDescription.trim() }]);
      setActionTitle("");
      setActionDescription("");
      return;
    }
    if (actionType === "add_lead_note") {
      if (!actionBody.trim()) {
        setError("Informe o texto da nota.");
        return;
      }
      setSteps((prev) => [...prev, { type: "ACAO", action: "add_lead_note", body: actionBody.trim() }]);
      setActionBody("");
      return;
    }
    if (!actionUrl.trim()) {
      setError("Informe a URL do webhook.");
      return;
    }
    setSteps((prev) => [...prev, { type: "ACAO", action: "webhook", url: actionUrl.trim() }]);
    setActionUrl("");
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    const response = await fetch(`/api/workflows/${workflowId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar o rascunho.");
      return;
    }
    setSavedMessage("Rascunho salvo.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {steps.length === 0 && <p className="text-sm text-[#98A2B3]">Nenhum passo ainda.</p>}
        {steps.map((step, index) => (
          <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm">
            <span className="text-[#101828]">
              <span className="mr-2 text-xs font-semibold text-[#98A2B3]">{index + 1}.</span>
              {summarizeStep(step)}
            </span>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="rounded-md px-1.5 text-xs text-[#475467] hover:bg-[#F6F7FB] disabled:opacity-30">
                ↑
              </button>
              <button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="rounded-md px-1.5 text-xs text-[#475467] hover:bg-[#F6F7FB] disabled:opacity-30">
                ↓
              </button>
              <button type="button" onClick={() => removeStep(index)} className="rounded-md px-1.5 text-xs text-[#D94343] hover:bg-[#FEE4E2]">
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Adicionar passo</p>
        <div className="mb-2 flex gap-1.5">
          {(["CONDICAO", "ESPERA", "ACAO"] as NewStepType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setNewType(t)}
              className={`h-8 flex-1 rounded-md text-xs font-medium ${newType === t ? "bg-[#6847F5] text-white" : "border border-[#D0D5DD] text-[#344054]"}`}
            >
              {t === "CONDICAO" ? "Condição" : t === "ESPERA" ? "Espera" : "Ação"}
            </button>
          ))}
        </div>

        {newType === "CONDICAO" && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={conditionField}
                onChange={(e) => setConditionField(e.target.value)}
                placeholder="campo"
                list="condition-fields"
                className="h-9 flex-1 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
              />
              <datalist id="condition-fields">
                {fields.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <select
                value={conditionOperator}
                onChange={(e) => setConditionOperator(e.target.value as ConditionOperator)}
                className="h-9 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
              >
                {CONDITION_OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {CONDITION_OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
            </div>
            {conditionOperator !== "exists" && conditionOperator !== "not_exists" && (
              <input
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder="valor"
                className="h-9 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
              />
            )}
            <p className="text-[10px] text-[#98A2B3]">Campos disponíveis pra este gatilho: {fields.join(", ")}</p>
          </div>
        )}

        {newType === "ESPERA" && (
          <div className="flex flex-col gap-1">
            <input
              type="number"
              min="1"
              value={waitMinutes}
              onChange={(e) => setWaitMinutes(e.target.value)}
              className="h-9 w-32 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
            />
            <p className="text-[10px] text-[#98A2B3]">Em minutos — 60 = 1 hora, 1440 = 1 dia. Avança só quando alguém clicar &quot;Processar automações pendentes&quot;.</p>
          </div>
        )}

        {newType === "ACAO" && (
          <div className="flex flex-col gap-2">
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as WorkflowActionType)}
              className="h-9 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
            >
              {(Object.keys(WORKFLOW_ACTION_LABELS) as WorkflowActionType[]).map((a) => (
                <option key={a} value={a}>
                  {WORKFLOW_ACTION_LABELS[a]}
                </option>
              ))}
            </select>
            {actionType === "create_task" && (
              <>
                <input
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Título da tarefa (aceita {{campo}})"
                  className="h-9 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
                />
                <input
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className="h-9 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
                />
              </>
            )}
            {actionType === "add_lead_note" && (
              <input
                value={actionBody}
                onChange={(e) => setActionBody(e.target.value)}
                placeholder="Texto da nota (aceita {{campo}})"
                className="h-9 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
              />
            )}
            {actionType === "webhook" && (
              <input
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://..."
                className="h-9 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
              />
            )}
            <p className="text-[10px] text-[#98A2B3]">Campos disponíveis pra interpolar: {fields.map((f) => `{{${f}}}`).join(", ")}</p>
          </div>
        )}

        <button
          type="button"
          onClick={addStep}
          className="mt-2 flex h-8 items-center justify-center rounded-md border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] hover:bg-white"
        >
          Adicionar
        </button>
      </div>

      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveDraft()}
          className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#6847F5" }}
        >
          {saving ? "Salvando..." : "Salvar rascunho"}
        </button>
        {savedMessage && <span className="text-xs text-[#166534]">{savedMessage}</span>}
      </div>
    </div>
  );
}
