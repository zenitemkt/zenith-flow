import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("propostas: isolamento, token único e ciclo de decisão preservando dados", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.proposalStatusHistory.deleteMany({ where: { proposal: { agencyId: { in: createdAgencyIds } } } });
    await prisma.proposal.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna propostas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.proposal.create({ data: { agencyId: a.id, name: "Proposta A", content: "...", token: "token-a" } });
    await prisma.proposal.create({ data: { agencyId: b.id, name: "Proposta B", content: "...", token: "token-b" } });

    const proposalsOfA = await prisma.proposal.findMany({ where: { agencyId: a.id } });
    const proposalsOfB = await prisma.proposal.findMany({ where: { agencyId: b.id } });

    expect(proposalsOfA.map((p) => p.name)).toEqual(["Proposta A"]);
    expect(proposalsOfB.map((p) => p.name)).toEqual(["Proposta B"]);
  });

  it("token é único globalmente (@@unique), mesmo entre agências diferentes", async () => {
    const a = await createAgency("gamma");
    const b = await createAgency("delta");

    await prisma.proposal.create({ data: { agencyId: a.id, name: "Proposta Gamma", content: "...", token: "token-unico" } });

    await expect(
      prisma.proposal.create({ data: { agencyId: b.id, name: "Proposta Delta", content: "...", token: "token-unico" } }),
    ).rejects.toThrow();
  });

  it("recusar uma proposta grava o motivo e histórico, preservando o conteúdo original", async () => {
    const agency = await createAgency("epsilon");
    const proposal = await prisma.proposal.create({
      data: {
        agencyId: agency.id,
        name: "Proposta Epsilon",
        content: "Escopo original",
        valueCents: 300000,
        status: "VISUALIZADA",
        token: "token-epsilon",
      },
    });

    await prisma.$transaction([
      prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: "REJEITADA", rejectedReason: "Preço acima do orçamento", respondedAt: new Date() },
      }),
      prisma.proposalStatusHistory.create({
        data: {
          proposalId: proposal.id,
          fromStatus: "VISUALIZADA",
          toStatus: "REJEITADA",
          reason: "Preço acima do orçamento",
        },
      }),
    ]);

    const updated = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    const history = await prisma.proposalStatusHistory.findMany({ where: { proposalId: proposal.id } });

    expect(updated?.status).toBe("REJEITADA");
    expect(updated?.rejectedReason).toBe("Preço acima do orçamento");
    expect(updated?.content).toBe("Escopo original");
    expect(updated?.valueCents).toBe(300000);
    expect(history).toHaveLength(1);
    expect(history[0]!.toStatus).toBe("REJEITADA");
  });
});
