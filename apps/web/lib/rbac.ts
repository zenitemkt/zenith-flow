import type { MembershipRole } from "@zenite-mkt/db";

/** Rótulos e papéis iniciais — seção 7.1 do manual. */
export const ROLE_LABELS: Record<MembershipRole, string> = {
  SUPER_ADMIN: "Super Admin",
  AGENCY_ADMIN: "Admin da Agência",
  MANAGER: "Gestor",
  ANALYST: "Analista",
  FINANCE: "Financeiro",
  HR: "RH",
  CLIENT_ADMIN: "Cliente Admin",
  CLIENT_VIEWER: "Cliente Viewer",
};

const TEAM_MANAGEMENT_ROLES: MembershipRole[] = ["SUPER_ADMIN", "AGENCY_ADMIN"];
const TIMESHEET_APPROVAL_ROLES: MembershipRole[] = ["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"];
const ENPS_VIEW_ROLES: MembershipRole[] = ["SUPER_ADMIN", "AGENCY_ADMIN", "HR"];

export function hasRole(role: MembershipRole, allowed: MembershipRole[]): boolean {
  return allowed.includes(role);
}

export function canManageTeam(role: MembershipRole): boolean {
  return hasRole(role, TEAM_MANAGEMENT_ROLES);
}

/** Rotacionar a chave de tracking invalida o snippet já publicado no site — mesma sensibilidade de gerenciar equipe. */
export function canManageIntegrations(role: MembershipRole): boolean {
  return hasRole(role, TEAM_MANAGEMENT_ROLES);
}

/**
 * Pedido do usuário, 2026-09-07: qualquer um pode ver todas as colunas do
 * board de Operação, mas só quem está na vez (`Task.assigneeUserId`) pode
 * mover o card — evita mexer no card de outra pessoa por acidente. Admin
 * sempre pode mover qualquer card, mesmo critério de quem gerencia a equipe.
 */
export function canManageAnyTask(role: MembershipRole): boolean {
  return hasRole(role, TEAM_MANAGEMENT_ROLES);
}

/** Seção 21: "pessoa acessa seus dados; gestor acessa escopo autorizado." */
export function canApproveTimesheets(role: MembershipRole): boolean {
  return hasRole(role, TIMESHEET_APPROVAL_ROLES);
}

export function isClientRole(role: MembershipRole): boolean {
  return role === "CLIENT_ADMIN" || role === "CLIENT_VIEWER";
}

/** Seção 32.1: "eNPS... acesso é restrito" — só quem cuida de gente vê resultado de equipe. */
export function canViewEnps(role: MembershipRole): boolean {
  return hasRole(role, ENPS_VIEW_ROLES);
}
