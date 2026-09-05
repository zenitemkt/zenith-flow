import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("health score: isolamento e histórico append-only", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.healthScoreSnapshot.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.client.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna snapshots de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");
    const clientA = await prisma.client.create({ data: { agencyId: a.id, name: "Cliente A" } });
    const clientB = await prisma.client.create({ data: { agencyId: b.id, name: "Cliente B" } });

    await prisma.healthScoreSnapshot.create({
      data: { agencyId: a.id, clientId: clientA.id, score: 90, modelVersion: "v1", breakdown: {} },
    });
    await prisma.healthScoreSnapshot.create({
      data: { agencyId: b.id, clientId: clientB.id, score: 40, modelVersion: "v1", breakdown: {} },
    });

    const snapshotsOfA = await prisma.healthScoreSnapshot.findMany({ where: { agencyId: a.id } });
    const snapshotsOfB = await prisma.healthScoreSnapshot.findMany({ where: { agencyId: b.id } });

    expect(snapshotsOfA.map((s) => s.score)).toEqual([90]);
    expect(snapshotsOfB.map((s) => s.score)).toEqual([40]);
  });

  it("recalcular cria uma linha nova, nunca sobrescreve a anterior (histórico append-only)", async () => {
    const agency = await createAgency("gamma");
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Cliente Gamma" } });

    await prisma.healthScoreSnapshot.create({
      data: { agencyId: agency.id, clientId: client.id, score: 60, modelVersion: "v1", breakdown: { note: "primeiro" } },
    });
    await new Promise((r) => setTimeout(r, 5));
    await prisma.healthScoreSnapshot.create({
      data: { agencyId: agency.id, clientId: client.id, score: 80, modelVersion: "v1", breakdown: { note: "segundo" } },
    });

    const history = await prisma.healthScoreSnapshot.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
    });

    expect(history).toHaveLength(2);
    expect(history[0]!.score).toBe(80); // mais recente primeiro
    expect(history[1]!.score).toBe(60); // o antigo continua existindo, intacto
  });
});
