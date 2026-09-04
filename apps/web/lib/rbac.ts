import type { MembershipRole } from "@zenith/db";

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

export function hasRole(role: MembershipRole, allowed: MembershipRole[]): boolean {
  return allowed.includes(role);
}

export function canManageTeam(role: MembershipRole): boolean {
  return hasRole(role, TEAM_MANAGEMENT_ROLES);
}

export function isClientRole(role: MembershipRole): boolean {
  return role === "CLIENT_ADMIN" || role === "CLIENT_VIEWER";
}
