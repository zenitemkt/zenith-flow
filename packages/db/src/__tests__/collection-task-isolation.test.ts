import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("régua de cobrança: tarefa vinculada ao lançamento", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.financeEntry.updateMany({
      where: { agencyId: { in: createdAgencyIds } },
      data: { collectionTaskId: null },
    });
    await prisma.task.deleteMany({ where: { project: { agencyId: { in: createdAgencyIds } } } });
    await prisma.project.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.financeEntry.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
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

  it("apagar a tarefa de cobrança limpa o vínculo no lançamento, sem apagar o lançamento (onDelete: SetNull)", async () => {
    const agency = await createAgency("alpha");
    const project = await prisma.project.create({ data: { agencyId: agency.id, name: "Cobrança" } });
    const task = await prisma.task.create({ data: { projectId: project.id, title: "Cobrar fatura" } });
    const entry = await prisma.financeEntry.create({
      data: {
        agencyId: agency.id,
        type: "RECEITA",
        status: "VENCIDO",
        description: "Fatura teste",
        amountCents: 10000,
        competencyDate: new Date(),
        dueDate: new Date(),
        collectionTaskId: task.id,
      },
    });

    await prisma.task.delete({ where: { id: task.id } });

    const reloaded = await prisma.financeEntry.findUnique({ where: { id: entry.id } });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.collectionTaskId).toBeNull();
  });

  it("uma tarefa só pode ser vinculada a um lançamento por vez (@@unique em collectionTaskId)", async () => {
    const agency = await createAgency("beta");
    const project = await prisma.project.create({ data: { agencyId: agency.id, name: "Cobrança" } });
    const task = await prisma.task.create({ data: { projectId: project.id, title: "Cobrar fatura" } });

    await prisma.financeEntry.create({
      data: {
        agencyId: agency.id,
        type: "RECEITA",
        status: "VENCIDO",
        description: "Fatura 1",
        amountCents: 5000,
        competencyDate: new Date(),
        dueDate: new Date(),
        collectionTaskId: task.id,
      },
    });

    await expect(
      prisma.financeEntry.create({
        data: {
          agencyId: agency.id,
          type: "RECEITA",
          status: "VENCIDO",
          description: "Fatura 2",
          amountCents: 7000,
          competencyDate: new Date(),
          dueDate: new Date(),
          collectionTaskId: task.id,
        },
      }),
    ).rejects.toThrow();
  });
});
