import type { WorkflowStatus, WorkflowRunStatus, WorkflowStepType } from "@zenith/db";

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  RASCUNHO: "Rascunho",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ARQUIVADO: "Arquivado",
};

export const WORKFLOW_STATUS_BADGE_CLASS: Record<WorkflowStatus, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ATIVO: "bg-[#DCFCE7] text-[#166534]",
  PAUSADO: "bg-[#FEF3C7] text-[#92600A]",
  ARQUIVADO: "bg-[#F2F4F7] text-[#98A2B3]",
};

/** Sem re-edição/republicação de workflow já ativo nesta fatia — ver docs/DECISIONS.md. */
export const WORKFLOW_STATUS_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  RASCUNHO: ["ARQUIVADO"],
  ATIVO: ["PAUSADO", "ARQUIVADO"],
  PAUSADO: ["ATIVO", "ARQUIVADO"],
  ARQUIVADO: [],
};

export function canTransitionWorkflow(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return WORKFLOW_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const WORKFLOW_RUN_STATUS_LABELS: Record<WorkflowRunStatus, string> = {
  EXECUTANDO: "Executando",
  AGUARDANDO: "Aguardando",
  CONCLUIDO: "Concluído",
  FALHOU: "Falhou",
};

export const WORKFLOW_RUN_STATUS_BADGE_CLASS: Record<WorkflowRunStatus, string> = {
  EXECUTANDO: "bg-[#EEF2FF] text-[#3730A3]",
  AGUARDANDO: "bg-[#FEF3C7] text-[#92600A]",
  CONCLUIDO: "bg-[#DCFCE7] text-[#166534]",
  FALHOU: "bg-[#FEE4E2] text-[#B42318]",
};

/**
 * Gatilhos ligados a mutações que já existem no produto — não a um
 * `outbox_events` formal (que não existe, ver docs/DECISIONS.md). Cada
 * evento documenta os campos que o payload carrega, pra a UI de condição
 * sugerir o que dá pra comparar.
 */
export interface TriggerEventDef {
  event: string;
  label: string;
  subjectType: "lead" | "opportunity" | "task";
  fields: string[];
}

export const TRIGGER_EVENTS: TriggerEventDef[] = [
  { event: "lead.created", label: "Lead criado", subjectType: "lead", fields: ["name", "email", "source"] },
  { event: "lead.qualified", label: "Lead qualificado", subjectType: "lead", fields: ["name", "email", "source"] },
  {
    event: "opportunity.won",
    label: "Oportunidade ganha",
    subjectType: "opportunity",
    fields: ["name", "valueCents", "leadId", "clientId"],
  },
  { event: "task.completed", label: "Tarefa concluída", subjectType: "task", fields: ["title", "clientId"] },
];

export function findTriggerEvent(event: string): TriggerEventDef | undefined {
  return TRIGGER_EVENTS.find((t) => t.event === event);
}

export type ConditionOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists" | "not_exists";

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: "é igual a",
  ne: "é diferente de",
  gt: "é maior que",
  gte: "é maior ou igual a",
  lt: "é menor que",
  lte: "é menor ou igual a",
  contains: "contém",
  exists: "está preenchido",
  not_exists: "está vazio",
};

export const CONDITION_OPERATORS: ConditionOperator[] = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "exists", "not_exists"];

export type WorkflowActionType = "create_task" | "add_lead_note" | "webhook";

export const WORKFLOW_ACTION_LABELS: Record<WorkflowActionType, string> = {
  create_task: "Criar tarefa em Operação",
  add_lead_note: "Adicionar nota ao lead",
  webhook: "Chamar webhook",
};

export type WorkflowStep =
  | { type: "CONDICAO"; field: string; operator: ConditionOperator; value: string }
  | { type: "ESPERA"; minutes: number }
  | { type: "ACAO"; action: "create_task"; title: string; description: string }
  | { type: "ACAO"; action: "add_lead_note"; body: string }
  | { type: "ACAO"; action: "webhook"; url: string };

export function isValidWorkflowStep(step: unknown): step is WorkflowStep {
  if (!step || typeof step !== "object") return false;
  const s = step as Record<string, unknown>;
  if (s.type === "CONDICAO") {
    return (
      typeof s.field === "string" &&
      s.field.length > 0 &&
      (CONDITION_OPERATORS as string[]).includes(s.operator as string) &&
      typeof s.value === "string"
    );
  }
  if (s.type === "ESPERA") {
    return typeof s.minutes === "number" && Number.isFinite(s.minutes) && s.minutes > 0;
  }
  if (s.type === "ACAO") {
    if (s.action === "create_task") return typeof s.title === "string" && s.title.trim().length > 0;
    if (s.action === "add_lead_note") return typeof s.body === "string" && s.body.trim().length > 0;
    if (s.action === "webhook") return typeof s.url === "string" && s.url.trim().length > 0;
  }
  return false;
}

/** Substitui `{{campo}}` pelo valor correspondente no payload — sem acesso a campos aninhados nesta fatia, só o nível raiz do evento. */
export function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = payload[key];
    return value === null || value === undefined ? "" : String(value);
  });
}
