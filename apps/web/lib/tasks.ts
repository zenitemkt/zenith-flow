import type { MembershipRole, WorkItemStatus } from "@zenith/db";
import { canManageAnyTask } from "@/lib/rbac";

/**
 * O enum inteiro (7 valores) é preservado porque Health Score
 * (`computeEntregasDimension`) e Risco de Churn (`computeLateDeliveriesSignal`)
 * dependem de valores específicos — mas o Kanban unificado só expõe/usa 3
 * como colunas (`BOARD_LANES`) e `CANCELADA` como ação. `PLANEJADA`,
 * `BLOQUEADA` e `REVISAO` ficam sem uso ativo no board novo. Ver docs/DECISIONS.md.
 */
export const WORK_ITEM_STATUS_LABELS: Record<WorkItemStatus, string> = {
  BACKLOG: "A Fazer",
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Fazendo",
  BLOQUEADA: "Bloqueada",
  REVISAO: "Revisão",
  CONCLUIDA: "Concluído",
  CANCELADA: "Cancelada",
};

/** As 3 lanes visíveis no board unificado de Operação, na ordem em que aparecem. */
export const BOARD_LANES: WorkItemStatus[] = ["BACKLOG", "EM_ANDAMENTO", "CONCLUIDA"];

/**
 * Transições simplificadas pro board de 3 lanes — cancelar é uma ação
 * disponível a partir de qualquer lane ativa, não uma coluna própria.
 */
export const WORK_ITEM_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  BACKLOG: ["EM_ANDAMENTO", "CANCELADA"],
  PLANEJADA: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["BACKLOG", "CONCLUIDA", "CANCELADA"],
  BLOQUEADA: ["EM_ANDAMENTO", "CANCELADA"],
  REVISAO: ["CONCLUIDA", "EM_ANDAMENTO"],
  CONCLUIDA: [],
  CANCELADA: [],
};

export function canTransitionWorkItem(from: WorkItemStatus, to: WorkItemStatus): boolean {
  return WORK_ITEM_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Task não pode avançar para "fazendo" ou "concluída" enquanto quem a bloqueia não estiver concluída. */
export function isBlockedByDependency(
  targetStatus: WorkItemStatus,
  blockerStatus: WorkItemStatus | null,
): boolean {
  if (!blockerStatus) return false;
  if (blockerStatus === "CONCLUIDA") return false;
  return targetStatus === "EM_ANDAMENTO" || targetStatus === "CONCLUIDA";
}

/**
 * Ver tudo, mover só o que é seu (pedido do usuário, 2026-09-07): uma tarefa
 * sem responsável é livre pra qualquer um da equipe; com responsável, só
 * quem está na vez ou um admin pode agir sobre ela.
 */
export function canActOnTask(
  role: MembershipRole,
  actorUserId: string,
  task: { assigneeUserId: string | null },
): boolean {
  if (!task.assigneeUserId) return true;
  if (task.assigneeUserId === actorUserId) return true;
  return canManageAnyTask(role);
}

/** Rótulo de prazo pro card: atrasado, vence em N dias, ou sem prazo (vai pro fim da fila). */
export function dueDateLabel(dueDate: Date | null, now: Date = new Date()): string {
  if (!dueDate) return "Sem prazo";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (diffDays < 0) return `Atrasado há ${Math.abs(diffDays)} dia${Math.abs(diffDays) === 1 ? "" : "s"}`;
  if (diffDays === 0) return "Vence hoje";
  return `Vence em ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
}
