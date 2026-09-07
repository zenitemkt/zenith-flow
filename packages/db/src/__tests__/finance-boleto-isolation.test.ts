import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("boleto anexado ao lançamento financeiro (pedido do usuário, 2026-09-07)", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.financeEntry.updateMany({
      where: { agencyId: { in: createdAgencyIds } },
      data: { boletoAssetId: null },
    });
    await prisma.financeEntry.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.mediaAsset.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("apagar o arquivo do boleto limpa o vínculo no lançamento, sem apagar o lançamento (onDelete: SetNull)", async () => {
    const agency = await createAgency("alpha");
    const asset = await prisma.mediaAsset.create({
      data: { agencyId: agency.id, key: `boletos/${suffix}-1.pdf`, fileName: "boleto.pdf", contentType: "application/pdf", sizeBytes: 1024 },
    });
    const entry = await prisma.financeEntry.create({
      data: {
        agencyId: agency.id,
        type: "RECEITA",
        status: "PENDENTE",
        description: "Fatura teste",
        amountCents: 10000,
        competencyDate: new Date(),
        dueDate: new Date(),
        boletoAssetId: asset.id,
      },
    });

    await prisma.mediaAsset.delete({ where: { id: asset.id } });

    const reloaded = await prisma.financeEntry.findUnique({ where: { id: entry.id } });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.boletoAssetId).toBeNull();
  });

  it("um arquivo só pode ser o boleto de um lançamento por vez (@@unique em boletoAssetId)", async () => {
    const agency = await createAgency("beta");
    const asset = await prisma.mediaAsset.create({
      data: { agencyId: agency.id, key: `boletos/${suffix}-2.pdf`, fileName: "boleto.pdf", contentType: "application/pdf", sizeBytes: 2048 },
    });

    await prisma.financeEntry.create({
      data: {
        agencyId: agency.id,
        type: "RECEITA",
        status: "PENDENTE",
        description: "Fatura 1",
        amountCents: 5000,
        competencyDate: new Date(),
        dueDate: new Date(),
        boletoAssetId: asset.id,
      },
    });

    await expect(
      prisma.financeEntry.create({
        data: {
          agencyId: agency.id,
          type: "RECEITA",
          status: "PENDENTE",
          description: "Fatura 2",
          amountCents: 7000,
          competencyDate: new Date(),
          dueDate: new Date(),
          boletoAssetId: asset.id,
        },
      }),
    ).rejects.toThrow();
  });
});
