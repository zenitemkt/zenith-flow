import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("eNPS: isolamento, convite único por campanha e anonimato estrutural da resposta", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.enpsSnapshot.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.enpsResponse.deleteMany({ where: { campaign: { agencyId: { in: createdAgencyIds } } } });
    await prisma.enpsInvite.deleteMany({ where: { campaign: { agencyId: { in: createdAgencyIds } } } });
    await prisma.enpsCampaign.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.employee.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna campanhas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.enpsCampaign.create({ data: { agencyId: a.id, name: "eNPS A", question: "0 a 10?" } });
    await prisma.enpsCampaign.create({ data: { agencyId: b.id, name: "eNPS B", question: "0 a 10?" } });

    const campaignsOfA = await prisma.enpsCampaign.findMany({ where: { agencyId: a.id } });
    const campaignsOfB = await prisma.enpsCampaign.findMany({ where: { agencyId: b.id } });

    expect(campaignsOfA.map((c) => c.name)).toEqual(["eNPS A"]);
    expect(campaignsOfB.map((c) => c.name)).toEqual(["eNPS B"]);
  });

  it("uma pessoa só pode ser convidada uma vez por campanha (@@unique campaignId+employeeId)", async () => {
    const agency = await createAgency("gamma");
    const employee = await prisma.employee.create({ data: { agencyId: agency.id, name: "Fulano" } });
    const campaign = await prisma.enpsCampaign.create({
      data: { agencyId: agency.id, name: "eNPS Gamma", question: "0 a 10?" },
    });

    await prisma.enpsInvite.create({
      data: { campaignId: campaign.id, employeeId: employee.id, email: "fulano@example.com", token: "token-1" },
    });

    await expect(
      prisma.enpsInvite.create({
        data: { campaignId: campaign.id, employeeId: employee.id, email: "fulano@example.com", token: "token-2" },
      }),
    ).rejects.toThrow();
  });

  it("EnpsResponse não tem nenhuma coluna que identifique quem respondeu (anonimato estrutural, não só de UI)", async () => {
    const agency = await createAgency("delta");
    const campaign = await prisma.enpsCampaign.create({
      data: { agencyId: agency.id, name: "eNPS Delta", question: "0 a 10?" },
    });
    const employee = await prisma.employee.create({ data: { agencyId: agency.id, name: "Ciclana" } });
    const invite = await prisma.enpsInvite.create({
      data: { campaignId: campaign.id, employeeId: employee.id, email: "ciclana@example.com", token: "token-delta" },
    });

    // Mesma dupla escrita que a rota pública faz: resposta anônima + convite marcado como respondido.
    await prisma.$transaction([
      prisma.enpsResponse.create({ data: { campaignId: campaign.id, score: 9, comment: "Ótimo lugar" } }),
      prisma.enpsInvite.update({ where: { id: invite.id }, data: { status: "RESPONDIDO", respondedAt: new Date() } }),
    ]);

    const response = await prisma.enpsResponse.findFirst({ where: { campaignId: campaign.id } });
    // Nenhuma dessas chaves existe no objeto retornado pelo Prisma — a prova
    // de que o schema não guarda employeeId/inviteId na resposta.
    expect(response).not.toHaveProperty("employeeId");
    expect(response).not.toHaveProperty("inviteId");
    expect(response?.score).toBe(9);

    const updatedInvite = await prisma.enpsInvite.findUnique({ where: { id: invite.id } });
    expect(updatedInvite?.status).toBe("RESPONDIDO");
  });
});
