import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("Tráfego - Raio X: isolamento de conjuntos, anúncios e pontos do mapa", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.ad.deleteMany({ where: { adSet: { campaign: { agencyId: { in: createdAgencyIds } } } } });
    await prisma.adSet.deleteMany({ where: { campaign: { agencyId: { in: createdAgencyIds } } } });
    await prisma.campaignGeoTarget.deleteMany({ where: { campaign: { agencyId: { in: createdAgencyIds } } } });
    await prisma.campaign.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithCampaign(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    const campaign = await prisma.campaign.create({
      data: { agencyId: agency.id, name: `Campanha ${label}`, channel: "Meta Ads" },
    });
    return { agency, campaign };
  }

  it("um conjunto de anúncios nunca aparece pela consulta de outra agência", async () => {
    const a = await createAgencyWithCampaign("alpha");
    const b = await createAgencyWithCampaign("beta");
    const adSetA = await prisma.adSet.create({ data: { campaignId: a.campaign.id, name: "Conjunto A" } });
    await prisma.adSet.create({ data: { campaignId: b.campaign.id, name: "Conjunto B" } });

    const adSetsOfA = await prisma.adSet.findMany({ where: { campaign: { agencyId: a.agency.id } } });

    expect(adSetsOfA.map((s) => s.id)).toEqual([adSetA.id]);
  });

  it("apagar um conjunto de anúncios apaga os anúncios dele em cascata", async () => {
    const { campaign } = await createAgencyWithCampaign("gamma");
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Conjunto" } });
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Anúncio 1" } });

    await prisma.adSet.delete({ where: { id: adSet.id } });

    const remaining = await prisma.ad.findMany({ where: { id: ad.id } });
    expect(remaining).toHaveLength(0);
  });

  it("apagar a campanha apaga conjuntos, anúncios e pontos do mapa em cascata", async () => {
    const { campaign } = await createAgencyWithCampaign("delta");
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Conjunto" } });
    await prisma.ad.create({ data: { adSetId: adSet.id, name: "Anúncio" } });
    await prisma.campaignGeoTarget.create({
      data: { campaignId: campaign.id, label: "São Paulo", lat: -23.55, lng: -46.63, radiusKm: 10 },
    });

    await prisma.campaign.delete({ where: { id: campaign.id } });

    expect(await prisma.adSet.findMany({ where: { campaignId: campaign.id } })).toHaveLength(0);
    expect(await prisma.campaignGeoTarget.findMany({ where: { campaignId: campaign.id } })).toHaveLength(0);
  });

  it("valor de resultado (resultValueCents) é opcional e não quebra métricas já existentes", async () => {
    const { campaign } = await createAgencyWithCampaign("epsilon");
    const metric = await prisma.campaignDailyMetric.create({
      data: { campaignId: campaign.id, date: new Date("2026-09-10T00:00:00.000Z"), spendCents: 1000, impressions: 100, clicks: 5 },
    });
    expect(metric.resultValueCents).toBeNull();

    const updated = await prisma.campaignDailyMetric.update({
      where: { id: metric.id },
      data: { resultValueCents: 5000 },
    });
    expect(updated.resultValueCents).toBe(5000);
  });
});
