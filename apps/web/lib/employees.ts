import type { EmployeeStatus, LeaveRequestStatus, LeaveType } from "@zenith/db";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ATIVO: "Ativo",
  AFASTADO: "Afastado",
  DESLIGADO: "Desligado",
};

/** Seção 20 do manual: convidado -> ativo -> afastado -> desligado (convidado já é coberto pelo Membership). */
export const EMPLOYEE_STATUS_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  ATIVO: ["AFASTADO", "DESLIGADO"],
  AFASTADO: ["ATIVO", "DESLIGADO"],
  DESLIGADO: [],
};

export function canTransitionEmployee(from: EmployeeStatus, to: EmployeeStatus): boolean {
  return EMPLOYEE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  FERIAS: "Férias",
  AUSENCIA: "Ausência",
};

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  SOLICITADA: "Solicitada",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  REALIZADA: "Realizada",
};

/**
 * Seção 20: "solicitadas -> aprovadas/rejeitadas -> realizadas". REALIZADA é
 * marcada manualmente quando o período já passou — mesmo padrão pragmático já
 * usado em Rotinas (geração manual em vez de worker real, ver DECISIONS.md):
 * a peça que importa (o fluxo de aprovação em si) está pronta; o gatilho
 * automático fica para quando `apps/worker` existir.
 */
export const LEAVE_STATUS_TRANSITIONS: Record<LeaveRequestStatus, LeaveRequestStatus[]> = {
  SOLICITADA: ["APROVADA", "REJEITADA"],
  APROVADA: ["REALIZADA"],
  REJEITADA: [],
  REALIZADA: [],
};

export function canTransitionLeave(from: LeaveRequestStatus, to: LeaveRequestStatus): boolean {
  return LEAVE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
