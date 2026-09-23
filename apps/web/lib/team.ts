import { prisma } from "@zenite-mkt/db";

export const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  AGENCY_ADMIN: "Admin da Agência",
  MANAGER: "Gestor",
  ANALYST: "Analista",
  FINANCE: "Financeiro",
  HR: "RH",
};

/** Pessoas internas ativas da agência (workspace kind AGENCY) — usado em seletores de responsável/membro. */
export async function getAgencyMembers(agencyId: string) {
  const memberships = await prisma.membership.findMany({
    where: { agencyId, status: "ACTIVE", workspace: { kind: "AGENCY" } },
    include: { user: true },
  });
  return memberships
    .filter((m) => m.userId)
    .map((m) => ({ userId: m.userId as string, name: m.user?.name ?? m.email }));
}
