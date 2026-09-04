import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("isolamento de demandas entre agências", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.request.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithRequest(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const req = await prisma.request.create({
      data: { agencyId: agency.id, title: `Demanda da ${label}` },
    });
    await prisma.requestStatusHistory.create({
      data: { requestId: req.id, toStatus: "NOVA" },
    });
    createdAgencyIds.push(agency.id);
    return { agency, req };
  }

  it("nunca retorna demandas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithRequest("alpha");
    const b = await createAgencyWithRequest("beta");

    const requestsOfA = await prisma.request.findMany({ where: { agencyId: a.agency.id } });
    const requestsOfB = await prisma.request.findMany({ where: { agencyId: b.agency.id } });

    expect(requestsOfA.map((r) => r.id)).toEqual([a.req.id]);
    expect(requestsOfB.map((r) => r.id)).toEqual([b.req.id]);
  });

  it("rejeição exige motivo (regra aplicada na API, aqui só provamos que o campo existe e é opcional por padrão)", async () => {
    const { req } = await createAgencyWithRequest("gamma");
    const updated = await prisma.request.update({
      where: { id: req.id },
      data: { status: "REJEITADA", rejectionReason: "Fora do escopo contratado" },
    });
    expect(updated.rejectionReason).toBe("Fora do escopo contratado");
  });
});
