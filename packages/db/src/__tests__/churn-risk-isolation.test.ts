import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("risco de churn: isolamento, histórico append-only e plano de retenção", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.retentionPlanStatusHistory.deleteMany({ where: { plan: { agencyId: { in: createdAgencyIds } } } });
    await prisma.retentionPlan.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.churnRiskSnapshot.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
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

    await prisma.churnRiskSnapshot.create({
      data: { agencyId: a.id, clientId: clientA.id, score: 60, band: "ALTO", modelVersion: "v1", signals: {} },
    });
    await prisma.churnRiskSnapshot.create({
      data: { agencyId: b.id, clientId: clientB.id, score: 0, band: "BAIXO", modelVersion: "v1", signals: {} },
    });

    const snapshotsOfA = await prisma.churnRiskSnapshot.findMany({ where: { agencyId: a.id } });
    const snapshotsOfB = await prisma.churnRiskSnapshot.findMany({ where: { agencyId: b.id } });

    expect(snapshotsOfA.map((s) => s.score)).toEqual([60]);
    expect(snapshotsOfB.map((s) => s.score)).toEqual([0]);
  });

  it("recalcular cria uma linha nova, nunca sobrescreve a anterior (histórico append-only)", async () => {
    const agency = await createAgency("gamma");
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Cliente Gamma" } });

    await prisma.churnRiskSnapshot.create({
      data: { agencyId: agency.id, clientId: client.id, score: 20, band: "BAIXO", modelVersion: "v1", signals: { nota: "primeiro" } },
    });
    await new Promise((r) => setTimeout(r, 5));
    await prisma.churnRiskSnapshot.create({
      data: { agencyId: agency.id, clientId: client.id, score: 60, band: "ALTO", modelVersion: "v1", signals: { nota: "segundo" } },
    });

    const history = await prisma.churnRiskSnapshot.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
    });

    expect(history).toHaveLength(2);
    expect(history[0]!.score).toBe(60);
    expect(history[1]!.score).toBe(20);
  });

  it("concluir um plano de retenção grava o histórico de status sem apagar o plano original", async () => {
    const agency = await createAgency("delta");
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Cliente Delta" } });

    const plan = await prisma.retentionPlan.create({
      data: {
        agencyId: agency.id,
        clientId: client.id,
        alertReason: "Duas faturas atrasadas",
        diagnosis: "Cliente mudou de contato financeiro",
        responsibleUserId: "user-fake-1",
        planDescription: "Ligar e renegociar prazo",
        createdByUserId: "user-fake-1",
      },
    });
    await prisma.retentionPlanStatusHistory.create({
      data: { planId: plan.id, toStatus: "ATIVO", actorUserId: "user-fake-1" },
    });

    await prisma.retentionPlan.update({
      where: { id: plan.id },
      data: { status: "CONCLUIDO", result: "Cliente renegociou e voltou a pagar em dia" },
    });
    await prisma.retentionPlanStatusHistory.create({
      data: { planId: plan.id, fromStatus: "ATIVO", toStatus: "CONCLUIDO", actorUserId: "user-fake-1" },
    });

    const history = await prisma.retentionPlanStatusHistory.findMany({
      where: { planId: plan.id },
      orderBy: { createdAt: "asc" },
    });
    const updatedPlan = await prisma.retentionPlan.findUnique({ where: { id: plan.id } });

    expect(history).toHaveLength(2);
    expect(history[0]!.toStatus).toBe("ATIVO");
    expect(history[1]!.toStatus).toBe("CONCLUIDO");
    expect(updatedPlan?.status).toBe("CONCLUIDO");
    expect(updatedPlan?.result).toBe("Cliente renegociou e voltou a pagar em dia");
  });
});
