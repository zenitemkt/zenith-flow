import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("relatórios mensais de concorrentes", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const agencyIds: string[] = [];

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { agencyId: { in: agencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: agencyIds } } });
  });

  async function setup(label: string) {
    const agency = await prisma.agency.create({ data: { name: `Agência ${label}`, slug: `${label}-${suffix}` } });
    agencyIds.push(agency.id);
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: `Cliente ${label}` } });
    return { agency, client };
  }

  it("separa o histórico por cliente e por agência", async () => {
    const a = await setup("alpha");
    const b = await setup("beta");
    const month = new Date("2026-10-01T00:00:00.000Z");
    await prisma.competitorReport.createMany({ data: [
      { clientId: a.client.id, month, content: "{}" },
      { clientId: b.client.id, month, content: "{}" },
    ] });
    const reportsOfA = await prisma.competitorReport.findMany({ where: { client: { agencyId: a.agency.id } } });
    expect(reportsOfA.map((report) => report.clientId)).toEqual([a.client.id]);
  });

  it("mantém somente um relatório por cliente e mês", async () => {
    const { client } = await setup("gamma");
    const month = new Date("2026-10-01T00:00:00.000Z");
    await prisma.competitorReport.create({ data: { clientId: client.id, month, content: "{}" } });
    await expect(prisma.competitorReport.create({ data: { clientId: client.id, month, content: "{}" } })).rejects.toThrow();
  });
});
