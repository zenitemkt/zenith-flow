import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("conteúdo: isolamento e aprovação por versão", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.contentApproval.deleteMany({
      where: { contentVersion: { contentItem: { agencyId: { in: createdAgencyIds } } } },
    });
    await prisma.contentVersion.deleteMany({
      where: { contentItem: { agencyId: { in: createdAgencyIds } } },
    });
    await prisma.contentItem.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.client.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithContent(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: `Cliente ${label}` } });
    const item = await prisma.contentItem.create({
      data: { agencyId: agency.id, clientId: client.id, title: `Post da ${label}`, channel: "INSTAGRAM" },
    });
    createdAgencyIds.push(agency.id);
    return { agency, client, item };
  }

  it("nunca retorna conteúdo de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithContent("alpha");
    const b = await createAgencyWithContent("beta");

    const itemsOfA = await prisma.contentItem.findMany({ where: { agencyId: a.agency.id } });
    const itemsOfB = await prisma.contentItem.findMany({ where: { agencyId: b.agency.id } });

    expect(itemsOfA.map((i) => i.id)).toEqual([a.item.id]);
    expect(itemsOfB.map((i) => i.id)).toEqual([b.item.id]);
  });

  it("aprovação vale só para a versão específica — nova versão exige novo token", async () => {
    const { item } = await createAgencyWithContent("gamma");

    const v1 = await prisma.contentVersion.create({
      data: { contentItemId: item.id, versionNumber: 1, assetUrl: "https://example.com/v1" },
    });
    const approval1 = await prisma.contentApproval.create({
      data: { contentVersionId: v1.id, token: `token-v1-${suffix}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    await prisma.contentApproval.update({
      where: { id: approval1.id },
      data: { status: "AJUSTES_SOLICITADOS", decidedAt: new Date(), decisionNote: "Trocar a cor" },
    });

    const v2 = await prisma.contentVersion.create({
      data: { contentItemId: item.id, versionNumber: 2, assetUrl: "https://example.com/v2" },
    });
    const approval2 = await prisma.contentApproval.create({
      data: { contentVersionId: v2.id, token: `token-v2-${suffix}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    expect(approval2.status).toBe("PENDENTE");
    const reloadedApproval1 = await prisma.contentApproval.findUnique({ where: { id: approval1.id } });
    expect(reloadedApproval1?.status).toBe("AJUSTES_SOLICITADOS");
    expect(reloadedApproval1?.decisionNote).toBe("Trocar a cor");
  });

  it("não permite duas aprovações para a mesma versão (@@unique contentVersionId)", async () => {
    const { item } = await createAgencyWithContent("delta");
    const version = await prisma.contentVersion.create({
      data: { contentItemId: item.id, versionNumber: 1, assetUrl: "https://example.com/v1" },
    });
    await prisma.contentApproval.create({
      data: { contentVersionId: version.id, token: `token-a-${suffix}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    await expect(
      prisma.contentApproval.create({
        data: { contentVersionId: version.id, token: `token-b-${suffix}`, expiresAt: new Date(Date.now() + 86400000) },
      }),
    ).rejects.toThrow();
  });
});
