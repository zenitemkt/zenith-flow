import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

/**
 * Prova o critério de aceite da Release 1A (seção 3.2 do manual): duas
 * agências distintas nunca enxergam dados uma da outra, mesmo compartilhando
 * o mesmo banco (isolamento lógico por agencyId/workspaceId, não por schema).
 */
describe("isolamento entre agências/workspaces", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await prisma.membership.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.workspace.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  async function createAgencyWithAdmin(label: string) {
    const user = await prisma.user.create({
      data: { name: `${label} Admin`, email: `${label}-${suffix}@example.com` },
    });
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const workspace = await prisma.workspace.create({
      data: { agencyId: agency.id, name: agency.name, kind: "AGENCY" },
    });
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        email: user.email,
        agencyId: agency.id,
        workspaceId: workspace.id,
        role: "AGENCY_ADMIN",
        status: "ACTIVE",
      },
    });

    createdAgencyIds.push(agency.id);
    createdUserIds.push(user.id);
    return { user, agency, workspace, membership };
  }

  it("nunca retorna memberships de outra agência ao consultar por workspace", async () => {
    const a = await createAgencyWithAdmin("alpha");
    const b = await createAgencyWithAdmin("beta");

    const membersOfA = await prisma.membership.findMany({
      where: { workspaceId: a.workspace.id },
    });
    const membersOfB = await prisma.membership.findMany({
      where: { workspaceId: b.workspace.id },
    });

    expect(membersOfA.map((m) => m.id)).toEqual([a.membership.id]);
    expect(membersOfB.map((m) => m.id)).toEqual([b.membership.id]);
    expect(membersOfA.some((m) => m.id === b.membership.id)).toBe(false);
  });

  it("resolve a agência ativa do usuário sem vazar para a agência de outro usuário", async () => {
    const a = await createAgencyWithAdmin("gamma");
    const b = await createAgencyWithAdmin("delta");

    // Mesma consulta usada por getCurrentMembership() em apps/web/lib/session.ts.
    const resolvedForA = await prisma.membership.findFirst({
      where: { userId: a.user.id, status: "ACTIVE" },
      include: { agency: true, workspace: true },
    });
    const resolvedForB = await prisma.membership.findFirst({
      where: { userId: b.user.id, status: "ACTIVE" },
      include: { agency: true, workspace: true },
    });

    expect(resolvedForA?.agencyId).toBe(a.agency.id);
    expect(resolvedForB?.agencyId).toBe(b.agency.id);
    expect(resolvedForA?.agencyId).not.toBe(resolvedForB?.agencyId);
  });

  it("não permite dois membros com o mesmo e-mail no mesmo workspace", async () => {
    const a = await createAgencyWithAdmin("epsilon");

    await expect(
      prisma.membership.create({
        data: {
          email: a.user.email,
          agencyId: a.agency.id,
          workspaceId: a.workspace.id,
          role: "ANALYST",
          status: "INVITED",
        },
      }),
    ).rejects.toThrow();
  });
});
