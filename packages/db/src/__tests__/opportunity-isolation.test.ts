import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("pipeline: isolamento, estágio único por ordem e ciclo ganho/perdido", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.opportunityStatusHistory.deleteMany({ where: { opportunity: { agencyId: { in: createdAgencyIds } } } });
    await prisma.opportunity.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.pipelineStage.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna oportunidades de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");
    const stageA = await prisma.pipelineStage.create({ data: { agencyId: a.id, name: "Novo contato", order: 0 } });
    const stageB = await prisma.pipelineStage.create({ data: { agencyId: b.id, name: "Novo contato", order: 0 } });

    await prisma.opportunity.create({ data: { agencyId: a.id, name: "Negócio A", stageId: stageA.id } });
    await prisma.opportunity.create({ data: { agencyId: b.id, name: "Negócio B", stageId: stageB.id } });

    const opportunitiesOfA = await prisma.opportunity.findMany({ where: { agencyId: a.id } });
    const opportunitiesOfB = await prisma.opportunity.findMany({ where: { agencyId: b.id } });

    expect(opportunitiesOfA.map((o) => o.name)).toEqual(["Negócio A"]);
    expect(opportunitiesOfB.map((o) => o.name)).toEqual(["Negócio B"]);
  });

  it("não permite dois estágios na mesma posição da mesma agência (@@unique agencyId+order)", async () => {
    const agency = await createAgency("gamma");
    await prisma.pipelineStage.create({ data: { agencyId: agency.id, name: "Novo contato", order: 0 } });

    await expect(
      prisma.pipelineStage.create({ data: { agencyId: agency.id, name: "Outro nome", order: 0 } }),
    ).rejects.toThrow();
  });

  it("marcar como perdida grava o motivo e histórico, sem apagar a oportunidade original", async () => {
    const agency = await createAgency("delta");
    const stage = await prisma.pipelineStage.create({ data: { agencyId: agency.id, name: "Negociação", order: 0 } });
    const opportunity = await prisma.opportunity.create({
      data: { agencyId: agency.id, name: "Negócio Delta", stageId: stage.id, valueCents: 500000 },
    });

    await prisma.$transaction(async (tx) => {
      await tx.opportunity.update({
        where: { id: opportunity.id },
        data: { status: "LOST", lostReason: "Cliente escolheu concorrente" },
      });
      await tx.opportunityStatusHistory.create({
        data: { opportunityId: opportunity.id, toStatus: "LOST", reason: "Cliente escolheu concorrente" },
      });
    });

    const updated = await prisma.opportunity.findUnique({ where: { id: opportunity.id } });
    const history = await prisma.opportunityStatusHistory.findMany({ where: { opportunityId: opportunity.id } });

    expect(updated?.status).toBe("LOST");
    expect(updated?.lostReason).toBe("Cliente escolheu concorrente");
    expect(updated?.valueCents).toBe(500000);
    expect(history).toHaveLength(1);
    expect(history[0]!.toStatus).toBe("LOST");
  });
});
