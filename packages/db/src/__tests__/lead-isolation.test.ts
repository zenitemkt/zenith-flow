import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("leads: isolamento, e-mail único por agência e conversão em cliente", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.leadNote.deleteMany({ where: { lead: { agencyId: { in: createdAgencyIds } } } });
    await prisma.leadStatusHistory.deleteMany({ where: { lead: { agencyId: { in: createdAgencyIds } } } });
    await prisma.lead.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.clientContact.deleteMany({ where: { client: { agencyId: { in: createdAgencyIds } } } });
    await prisma.clientStatusHistory.deleteMany({ where: { client: { agencyId: { in: createdAgencyIds } } } });
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

  it("nunca retorna leads de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.lead.create({ data: { agencyId: a.id, name: "Lead A" } });
    await prisma.lead.create({ data: { agencyId: b.id, name: "Lead B" } });

    const leadsOfA = await prisma.lead.findMany({ where: { agencyId: a.id } });
    const leadsOfB = await prisma.lead.findMany({ where: { agencyId: b.id } });

    expect(leadsOfA.map((l) => l.name)).toEqual(["Lead A"]);
    expect(leadsOfB.map((l) => l.name)).toEqual(["Lead B"]);
  });

  it("e-mail é único por agência (@@unique agencyId+email), mas duas agências podem ter leads com o mesmo e-mail", async () => {
    const a = await createAgency("gamma");
    const b = await createAgency("delta");

    await prisma.lead.create({ data: { agencyId: a.id, name: "Fulano", email: "fulano@example.com" } });

    await expect(
      prisma.lead.create({ data: { agencyId: a.id, name: "Fulano de novo", email: "fulano@example.com" } }),
    ).rejects.toThrow();

    // Mesmo e-mail em outra agência não deve colidir (constraint é por agência, não global).
    await expect(
      prisma.lead.create({ data: { agencyId: b.id, name: "Fulano em outra agência", email: "fulano@example.com" } }),
    ).resolves.toBeTruthy();
  });

  it("converter um lead qualificado cria um Client e preserva o vínculo, sem apagar o lead", async () => {
    const agency = await createAgency("epsilon");
    const lead = await prisma.lead.create({
      data: { agencyId: agency.id, name: "Cliente Potencial", email: "potencial@example.com", status: "QUALIFICADO" },
    });

    const client = await prisma.client.create({ data: { agencyId: agency.id, name: lead.name, email: lead.email } });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "CONVERTIDO", convertedClientId: client.id } });

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id }, include: { convertedClient: true } });

    expect(updatedLead?.status).toBe("CONVERTIDO");
    expect(updatedLead?.convertedClient?.id).toBe(client.id);
  });
});
