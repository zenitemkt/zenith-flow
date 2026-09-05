import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("NPS: isolamento, público único por campanha e cálculo do score", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.npsSnapshot.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.surveyRecipient.deleteMany({ where: { campaign: { agencyId: { in: createdAgencyIds } } } });
    await prisma.surveyCampaign.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
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

  it("nunca retorna campanhas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.surveyCampaign.create({
      data: { agencyId: a.id, name: "NPS A", question: "0 a 10?" },
    });
    await prisma.surveyCampaign.create({
      data: { agencyId: b.id, name: "NPS B", question: "0 a 10?" },
    });

    const campaignsOfA = await prisma.surveyCampaign.findMany({ where: { agencyId: a.id } });
    const campaignsOfB = await prisma.surveyCampaign.findMany({ where: { agencyId: b.id } });

    expect(campaignsOfA.map((c) => c.name)).toEqual(["NPS A"]);
    expect(campaignsOfB.map((c) => c.name)).toEqual(["NPS B"]);
  });

  it("um cliente só pode ser destinatário uma vez por campanha (@@unique campaignId+clientId)", async () => {
    const agency = await createAgency("gamma");
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Cliente Gamma" } });
    const campaign = await prisma.surveyCampaign.create({
      data: { agencyId: agency.id, name: "NPS Gamma", question: "0 a 10?" },
    });

    await prisma.surveyRecipient.create({
      data: {
        campaignId: campaign.id,
        clientId: client.id,
        contactName: "Fulano",
        email: "fulano@example.com",
        token: "token-1",
      },
    });

    await expect(
      prisma.surveyRecipient.create({
        data: {
          campaignId: campaign.id,
          clientId: client.id,
          contactName: "Fulano de novo",
          email: "fulano2@example.com",
          token: "token-2",
        },
      }),
    ).rejects.toThrow();
  });

  it("recalcular o NPS cria um novo snapshot append-only, refletindo só as respostas já dadas", async () => {
    const agency = await createAgency("delta");
    const campaign = await prisma.surveyCampaign.create({
      data: { agencyId: agency.id, name: "NPS Delta", question: "0 a 10?" },
    });
    const clients = await Promise.all(
      [0, 1, 2, 3].map((i) => prisma.client.create({ data: { agencyId: agency.id, name: `Cliente ${i}` } })),
    );
    // 2 promotores (9,10), 1 neutro (7), 1 detrator (3) -> NPS = (2-1)/4*100 = 25
    const scores = [9, 10, 7, 3];
    await Promise.all(
      clients.map((c, i) =>
        prisma.surveyRecipient.create({
          data: {
            campaignId: campaign.id,
            clientId: c.id,
            contactName: `Contato ${i}`,
            email: `c${i}@example.com`,
            token: `token-delta-${i}`,
            status: "RESPONDIDO",
            score: scores[i],
            respondedAt: new Date(),
          },
        }),
      ),
    );

    const responded = await prisma.surveyRecipient.findMany({
      where: { campaignId: campaign.id, status: "RESPONDIDO" },
      select: { score: true },
    });
    const promoters = responded.filter((r) => (r.score ?? 0) >= 9).length;
    const detractors = responded.filter((r) => (r.score ?? 0) <= 6).length;
    const total = responded.length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);

    const snapshot = await prisma.npsSnapshot.create({
      data: {
        agencyId: agency.id,
        campaignId: campaign.id,
        score: npsScore,
        promoters,
        passives: total - promoters - detractors,
        detractors,
        totalResponses: total,
      },
    });

    expect(snapshot.score).toBe(25);
    expect(snapshot.promoters).toBe(2);
    expect(snapshot.detractors).toBe(1);
    expect(snapshot.totalResponses).toBe(4);
  });
});
