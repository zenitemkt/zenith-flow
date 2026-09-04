import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("fornecedores: isolamento e bloqueio", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.vendorOrder.deleteMany({ where: { vendor: { agencyId: { in: createdAgencyIds } } } });
    await prisma.vendor.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithVendor(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const vendor = await prisma.vendor.create({ data: { agencyId: agency.id, name: `Fornecedor ${label}` } });
    createdAgencyIds.push(agency.id);
    return { agency, vendor };
  }

  it("nunca retorna fornecedores de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithVendor("alpha");
    const b = await createAgencyWithVendor("beta");

    const vendorsOfA = await prisma.vendor.findMany({ where: { agencyId: a.agency.id } });
    const vendorsOfB = await prisma.vendor.findMany({ where: { agencyId: b.agency.id } });

    expect(vendorsOfA.map((v) => v.id)).toEqual([a.vendor.id]);
    expect(vendorsOfB.map((v) => v.id)).toEqual([b.vendor.id]);
  });

  it("uma ordem existente não é apagada quando o fornecedor é bloqueado", async () => {
    const { vendor } = await createAgencyWithVendor("gamma");
    const order = await prisma.vendorOrder.create({
      data: { vendorId: vendor.id, description: "Gravação de trilha sonora" },
    });

    await prisma.vendor.update({ where: { id: vendor.id }, data: { status: "BLOQUEADO" } });

    const stillThere = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe("SOLICITADA");
  });
});
