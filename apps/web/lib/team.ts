import { prisma } from "@zenite-mkt/db";

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
