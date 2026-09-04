import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

/**
 * Critério de aceite da Release 1B (seção 10 do manual): cadastrar, trocar
 * status e provar isolamento entre workspaces — aqui, ao nível do dado.
 */
describe("isolamento de clientes entre agências", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithClient(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const client = await prisma.client.create({
      data: { agencyId: agency.id, name: `Cliente da ${label}` },
    });
    await prisma.clientStatusHistory.create({
      data: { clientId: client.id, toStatus: "PROSPECT" },
    });
    createdAgencyIds.push(agency.id);
    return { agency, client };
  }

  it("nunca retorna clientes de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithClient("alpha");
    const b = await createAgencyWithClient("beta");

    const clientsOfA = await prisma.client.findMany({ where: { agencyId: a.agency.id } });
    const clientsOfB = await prisma.client.findMany({ where: { agencyId: b.agency.id } });

    expect(clientsOfA.map((c) => c.id)).toEqual([a.client.id]);
    expect(clientsOfB.map((c) => c.id)).toEqual([b.client.id]);
  });

  it("registra o histórico de status em ordem cronológica por cliente", async () => {
    const { client } = await createAgencyWithClient("gamma");

    await prisma.client.update({ where: { id: client.id }, data: { status: "ONBOARDING" } });
    await prisma.clientStatusHistory.create({
      data: { clientId: client.id, fromStatus: "PROSPECT", toStatus: "ONBOARDING" },
    });

    const history = await prisma.clientStatusHistory.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "asc" },
    });

    expect(history.map((h) => h.toStatus)).toEqual(["PROSPECT", "ONBOARDING"]);
  });
});
