import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("squads: isolamento e handoff de cliente", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.clientAllocation.deleteMany({ where: { client: { agencyId: { in: createdAgencyIds } } } });
    await prisma.squadMember.deleteMany({ where: { squad: { agencyId: { in: createdAgencyIds } } } });
    await prisma.squad.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.client.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithSquad(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const squad = await prisma.squad.create({ data: { agencyId: agency.id, name: `Squad ${label}` } });
    createdAgencyIds.push(agency.id);
    return { agency, squad };
  }

  it("nunca retorna squads de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithSquad("alpha");
    const b = await createAgencyWithSquad("beta");

    const squadsOfA = await prisma.squad.findMany({ where: { agencyId: a.agency.id } });
    const squadsOfB = await prisma.squad.findMany({ where: { agencyId: b.agency.id } });

    expect(squadsOfA.map((s) => s.id)).toEqual([a.squad.id]);
    expect(squadsOfB.map((s) => s.id)).toEqual([b.squad.id]);
  });

  it("reatribuir squad do cliente encerra a alocação anterior sem apagar o histórico", async () => {
    const { agency, squad: squadA } = await createAgencyWithSquad("gamma");
    const squadB = await prisma.squad.create({ data: { agencyId: agency.id, name: "Squad gamma B" } });
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Cliente Handoff" } });

    const firstAllocation = await prisma.clientAllocation.create({
      data: { clientId: client.id, squadId: squadA.id },
    });

    // Simula o handoff feito pela rota /api/squads/:id/allocate
    await prisma.$transaction([
      prisma.clientAllocation.update({
        where: { id: firstAllocation.id },
        data: { status: "ENCERRADA", endDate: new Date() },
      }),
      prisma.clientAllocation.create({ data: { clientId: client.id, squadId: squadB.id } }),
    ]);

    const history = await prisma.clientAllocation.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "asc" },
    });

    expect(history).toHaveLength(2);
    expect(history[0]?.status).toBe("ENCERRADA");
    expect(history[0]?.squadId).toBe(squadA.id);
    expect(history[1]?.status).toBe("ATIVA");
    expect(history[1]?.squadId).toBe(squadB.id);
  });

  it("não permite duas pessoas iguais no mesmo squad (@@unique squadId+userId)", async () => {
    const { agency, squad } = await createAgencyWithSquad("delta");
    const user = await prisma.user.create({
      data: { name: "Pessoa Delta", email: `delta-${suffix}@example.com` },
    });

    await prisma.squadMember.create({ data: { squadId: squad.id, userId: user.id } });

    await expect(
      prisma.squadMember.create({ data: { squadId: squad.id, userId: user.id } }),
    ).rejects.toThrow();

    await prisma.squadMember.deleteMany({ where: { squadId: squad.id } });
    await prisma.user.delete({ where: { id: user.id } });
    void agency;
  });
});
