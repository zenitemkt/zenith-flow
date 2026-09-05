import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("arquivos: isolamento e chave única no bucket", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
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

  it("nunca retorna arquivos de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.mediaAsset.create({
      data: { agencyId: a.id, key: `${a.id}/a.pdf`, fileName: "a.pdf", contentType: "application/pdf", sizeBytes: 100 },
    });
    await prisma.mediaAsset.create({
      data: { agencyId: b.id, key: `${b.id}/b.pdf`, fileName: "b.pdf", contentType: "application/pdf", sizeBytes: 200 },
    });

    const assetsOfA = await prisma.mediaAsset.findMany({ where: { agencyId: a.id } });
    const assetsOfB = await prisma.mediaAsset.findMany({ where: { agencyId: b.id } });

    expect(assetsOfA.map((f) => f.fileName)).toEqual(["a.pdf"]);
    expect(assetsOfB.map((f) => f.fileName)).toEqual(["b.pdf"]);
  });

  it("arquivo fica associado ao cliente certo e some da lista se o cliente for removido (onDelete: SetNull)", async () => {
    const agency = await createAgency("gamma");
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Cliente Gamma" } });
    const asset = await prisma.mediaAsset.create({
      data: {
        agencyId: agency.id,
        clientId: client.id,
        key: `${agency.id}/gamma-doc.pdf`,
        fileName: "gamma-doc.pdf",
        contentType: "application/pdf",
        sizeBytes: 300,
      },
    });

    expect(asset.clientId).toBe(client.id);

    await prisma.client.delete({ where: { id: client.id } });
    const reloaded = await prisma.mediaAsset.findUnique({ where: { id: asset.id } });
    expect(reloaded?.clientId).toBeNull(); // arquivo preservado, só perde o vínculo
  });

  it("a chave do objeto no bucket é única (@@unique key)", async () => {
    const agency = await createAgency("delta");
    const key = `${agency.id}/duplicada.pdf`;
    await prisma.mediaAsset.create({
      data: { agencyId: agency.id, key, fileName: "duplicada.pdf", contentType: "application/pdf", sizeBytes: 10 },
    });

    await expect(
      prisma.mediaAsset.create({
        data: { agencyId: agency.id, key, fileName: "duplicada2.pdf", contentType: "application/pdf", sizeBytes: 20 },
      }),
    ).rejects.toThrow();
  });
});
