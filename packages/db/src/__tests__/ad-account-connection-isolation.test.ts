import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("AdAccountConnection: isolamento entre agências e unicidade por plataforma", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.adAccountConnection.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna a conexão de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha-ads");
    const b = await createAgency("beta-ads");

    await prisma.adAccountConnection.create({
      data: {
        agencyId: a.id,
        platform: "META",
        externalAccountId: `act_a_${suffix}`,
        accessTokenEnc: "v1:fake:fake:fake",
        scopes: ["ads_read"],
      },
    });
    await prisma.adAccountConnection.create({
      data: {
        agencyId: b.id,
        platform: "META",
        externalAccountId: `act_b_${suffix}`,
        accessTokenEnc: "v1:fake:fake:fake",
        scopes: ["ads_read"],
      },
    });

    const connectionsOfA = await prisma.adAccountConnection.findMany({ where: { agencyId: a.id } });
    const connectionsOfB = await prisma.adAccountConnection.findMany({ where: { agencyId: b.id } });

    expect(connectionsOfA.map((c) => c.externalAccountId)).toEqual([`act_a_${suffix}`]);
    expect(connectionsOfB.map((c) => c.externalAccountId)).toEqual([`act_b_${suffix}`]);
  });

  it("a constraint @@unique([agencyId, platform]) impede duas conexões Meta pra mesma agência", async () => {
    const agency = await createAgency("gamma-ads");

    await prisma.adAccountConnection.create({
      data: {
        agencyId: agency.id,
        platform: "META",
        externalAccountId: `act_first_${suffix}`,
        accessTokenEnc: "v1:fake:fake:fake",
        scopes: ["ads_read"],
      },
    });

    await expect(
      prisma.adAccountConnection.create({
        data: {
          agencyId: agency.id,
          platform: "META",
          externalAccountId: `act_second_${suffix}`,
          accessTokenEnc: "v1:fake:fake:fake",
          scopes: ["ads_read"],
        },
      }),
    ).rejects.toThrow();

    const connections = await prisma.adAccountConnection.findMany({ where: { agencyId: agency.id } });
    expect(connections).toHaveLength(1);
  });

  it("reconectar (upsert) substitui a conta e reativa o status, sem criar linha duplicada", async () => {
    const agency = await createAgency("delta-ads");

    await prisma.adAccountConnection.create({
      data: {
        agencyId: agency.id,
        platform: "META",
        externalAccountId: `act_old_${suffix}`,
        accessTokenEnc: "v1:fake:fake:fake",
        scopes: ["ads_read"],
        status: "EXPIRED",
      },
    });

    await prisma.adAccountConnection.upsert({
      where: { agencyId_platform: { agencyId: agency.id, platform: "META" } },
      create: {
        agencyId: agency.id,
        platform: "META",
        externalAccountId: `act_new_${suffix}`,
        accessTokenEnc: "v1:fake:fake:fake",
        scopes: ["ads_read"],
      },
      update: {
        externalAccountId: `act_new_${suffix}`,
        accessTokenEnc: "v1:fake:fake:fake",
        status: "ACTIVE",
      },
    });

    const connections = await prisma.adAccountConnection.findMany({ where: { agencyId: agency.id } });
    expect(connections).toHaveLength(1);
    expect(connections[0]?.externalAccountId).toBe(`act_new_${suffix}`);
    expect(connections[0]?.status).toBe("ACTIVE");
  });

  it("apagar a agência apaga a conexão em cascata (onDelete: Cascade)", async () => {
    const agency = await createAgency("epsilon-ads");
    await prisma.adAccountConnection.create({
      data: {
        agencyId: agency.id,
        platform: "GOOGLE",
        externalAccountId: `google_${suffix}`,
        accessTokenEnc: "v1:fake:fake:fake",
        scopes: ["ads_read"],
      },
    });

    await prisma.agency.delete({ where: { id: agency.id } });
    createdAgencyIds.splice(createdAgencyIds.indexOf(agency.id), 1);

    const remaining = await prisma.adAccountConnection.findMany({ where: { agencyId: agency.id } });
    expect(remaining).toHaveLength(0);
  });
});
