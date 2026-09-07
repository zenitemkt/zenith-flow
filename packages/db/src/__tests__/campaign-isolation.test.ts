import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("campanhas: isolamento e idempotência de métrica diária", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.campaignDailyMetric.deleteMany({ where: { campaign: { agencyId: { in: createdAgencyIds } } } });
    await prisma.campaign.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.client.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithCampaign(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const campaign = await prisma.campaign.create({
      data: { agencyId: agency.id, name: `Campanha ${label}`, channel: "Meta Ads" },
    });
    createdAgencyIds.push(agency.id);
    return { agency, campaign };
  }

  it("nunca retorna campanhas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithCampaign("alpha");
    const b = await createAgencyWithCampaign("beta");

    const campaignsOfA = await prisma.campaign.findMany({ where: { agencyId: a.agency.id } });
    const campaignsOfB = await prisma.campaign.findMany({ where: { agencyId: b.agency.id } });

    expect(campaignsOfA.map((c) => c.id)).toEqual([a.campaign.id]);
    expect(campaignsOfB.map((c) => c.id)).toEqual([b.campaign.id]);
  });

  it("a constraint @@unique([campaignId, date]) impede duas métricas do mesmo dia", async () => {
    const { campaign } = await createAgencyWithCampaign("gamma");
    const date = new Date("2026-09-01T00:00:00.000Z");

    await prisma.campaignDailyMetric.create({
      data: { campaignId: campaign.id, date, spendCents: 1000, impressions: 100, clicks: 5 },
    });

    await expect(
      prisma.campaignDailyMetric.create({
        data: { campaignId: campaign.id, date, spendCents: 2000, impressions: 200, clicks: 10 },
      }),
    ).rejects.toThrow();

    const metrics = await prisma.campaignDailyMetric.findMany({ where: { campaignId: campaign.id } });
    expect(metrics).toHaveLength(1);
  });

  it("pausar a campanha não apaga métricas já registradas", async () => {
    const { campaign } = await createAgencyWithCampaign("delta");
    await prisma.campaignDailyMetric.create({
      data: { campaignId: campaign.id, date: new Date("2026-09-02T00:00:00.000Z"), spendCents: 500, impressions: 50, clicks: 2 },
    });

    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSADA" } });

    const metrics = await prisma.campaignDailyMetric.findMany({ where: { campaignId: campaign.id } });
    expect(metrics).toHaveLength(1);
  });

  it("campanha de tráfego pago pode ser vinculada a um cliente, visível pra ele em /portal/trafego", async () => {
    const agency = await prisma.agency.create({ data: { name: `Agência epsilon ${suffix}`, slug: `epsilon-${suffix}` } });
    createdAgencyIds.push(agency.id);
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Cliente epsilon" } });
    const ownCampaign = await prisma.campaign.create({ data: { agencyId: agency.id, name: "Funil próprio", channel: "Orgânico" } });
    const clientCampaign = await prisma.campaign.create({
      data: { agencyId: agency.id, clientId: client.id, name: "Tráfego do cliente", channel: "Meta Ads" },
    });

    const campaignsOfClient = await prisma.campaign.findMany({ where: { clientId: client.id } });
    expect(campaignsOfClient.map((c) => c.id)).toEqual([clientCampaign.id]);

    const agencyOwnCampaigns = await prisma.campaign.findMany({ where: { agencyId: agency.id, clientId: null } });
    expect(agencyOwnCampaigns.map((c) => c.id)).toEqual([ownCampaign.id]);
  });
});
