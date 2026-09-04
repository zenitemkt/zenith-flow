import type { WorkItemStatus } from "@zenith/db";

export const WORK_ITEM_STATUS_LABELS: Record<WorkItemStatus, string> = {
  BACKLOG: "Backlog",
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADA: "Bloqueada",
  REVISAO: "Revisão",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

/** Colunas do quadro, na ordem em que aparecem (seção 14 do manual). */
export const TASK_BOARD_COLUMNS: WorkItemStatus[] = [
  "BACKLOG",
  "PLANEJADA",
  "EM_ANDAMENTO",
  "BLOQUEADA",
  "REVISAO",
  "CONCLUIDA",
];

export const WORK_ITEM_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  BACKLOG: ["PLANEJADA", "CANCELADA"],
  PLANEJADA: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["BLOQUEADA", "REVISAO", "CANCELADA"],
  BLOQUEADA: ["EM_ANDAMENTO", "CANCELADA"],
  REVISAO: ["CONCLUIDA", "EM_ANDAMENTO"],
  CONCLUIDA: [],
  CANCELADA: [],
};

export function canTransitionWorkItem(from: WorkItemStatus, to: WorkItemStatus): boolean {
  return WORK_ITEM_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Task não pode avançar para "em andamento" ou "concluída" enquanto quem a bloqueia não estiver concluída. */
export function isBlockedByDependency(
  targetStatus: WorkItemStatus,
  blockerStatus: WorkItemStatus | null,
): boolean {
  if (!blockerStatus) return false;
  if (blockerStatus === "CONCLUIDA") return false;
  return targetStatus === "EM_ANDAMENTO" || targetStatus === "CONCLUIDA";
}
