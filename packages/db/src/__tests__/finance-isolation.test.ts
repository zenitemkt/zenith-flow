import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("financeiro: isolamento, categoria única e estorno preserva original", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.financeEntryStatusHistory.deleteMany({
      where: { financeEntry: { agencyId: { in: createdAgencyIds } } },
    });
    await prisma.financeEntry.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.financeCategory.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna lançamentos de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");
    const today = new Date();

    await prisma.financeEntry.create({
      data: {
        agencyId: a.id, type: "RECEITA", description: "Receita A", amountCents: 10000,
        competencyDate: today, dueDate: today,
      },
    });
    await prisma.financeEntry.create({
      data: {
        agencyId: b.id, type: "DESPESA", description: "Despesa B", amountCents: 5000,
        competencyDate: today, dueDate: today,
      },
    });

    const entriesOfA = await prisma.financeEntry.findMany({ where: { agencyId: a.id } });
    const entriesOfB = await prisma.financeEntry.findMany({ where: { agencyId: b.id } });

    expect(entriesOfA.map((e) => e.description)).toEqual(["Receita A"]);
    expect(entriesOfB.map((e) => e.description)).toEqual(["Despesa B"]);
  });

  it("categoria é única por agência+nome+tipo (@@unique)", async () => {
    const agency = await createAgency("gamma");
    await prisma.financeCategory.create({ data: { agencyId: agency.id, name: "Mídia paga", type: "DESPESA" } });

    await expect(
      prisma.financeCategory.create({ data: { agencyId: agency.id, name: "Mídia paga", type: "DESPESA" } }),
    ).rejects.toThrow();

    // Mesmo nome, tipo diferente — não colide (RECEITA vs DESPESA são categorias distintas).
    const receitaCategory = await prisma.financeCategory.create({
      data: { agencyId: agency.id, name: "Mídia paga", type: "RECEITA" },
    });
    expect(receitaCategory.id).toBeTruthy();
  });

  it("estorno cria contra-lançamento negativo e preserva o original imutável", async () => {
    const agency = await createAgency("delta");
    const today = new Date();

    const original = await prisma.financeEntry.create({
      data: {
        agencyId: agency.id,
        type: "RECEITA",
        status: "LIQUIDADO",
        description: "Pagamento cliente X",
        amountCents: 150000,
        competencyDate: today,
        dueDate: today,
        settledDate: today,
      },
    });

    const reversal = await prisma.financeEntry.create({
      data: {
        agencyId: agency.id,
        type: "RECEITA",
        status: "LIQUIDADO",
        description: `Estorno: ${original.description}`,
        amountCents: -original.amountCents,
        competencyDate: today,
        dueDate: today,
        settledDate: today,
        reversalOfId: original.id,
      },
    });

    const reloadedOriginal = await prisma.financeEntry.findUnique({
      where: { id: original.id },
      include: { reversedBy: true },
    });

    expect(reloadedOriginal?.amountCents).toBe(150000); // original nunca muda
    expect(reloadedOriginal?.status).toBe("LIQUIDADO");
    expect(reloadedOriginal?.reversedBy?.id).toBe(reversal.id);
    expect(reversal.amountCents).toBe(-150000);

    // Um lançamento só pode ser estornado uma vez (@@unique reversalOfId).
    await expect(
      prisma.financeEntry.create({
        data: {
          agencyId: agency.id,
          type: "RECEITA",
          status: "LIQUIDADO",
          description: "Segundo estorno",
          amountCents: -150000,
          competencyDate: today,
          dueDate: today,
          reversalOfId: original.id,
        },
      }),
    ).rejects.toThrow();
  });
});
