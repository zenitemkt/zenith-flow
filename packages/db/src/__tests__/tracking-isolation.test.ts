import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("tracking: isolamento, deduplicação de evento e resolução de identidade", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.trackingConsent.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.trackingEvent.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.trackingSession.deleteMany({ where: { visitor: { agencyId: { in: createdAgencyIds } } } });
    await prisma.trackingVisitor.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.lead.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithVisitor(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}`, trackingWriteKey: `tk_${label}_${suffix}` },
    });
    const visitor = await prisma.trackingVisitor.create({ data: { agencyId: agency.id } });
    createdAgencyIds.push(agency.id);
    return { agency, visitor };
  }

  it("nunca retorna eventos de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithVisitor("alpha");
    const b = await createAgencyWithVisitor("beta");

    await prisma.trackingEvent.create({
      data: {
        agencyId: a.agency.id,
        visitorId: a.visitor.id,
        eventName: "page_view",
        eventId: `evt-a-${suffix}`,
        consent: { essencial: true, analytics: true },
        occurredAt: new Date(),
      },
    });
    await prisma.trackingEvent.create({
      data: {
        agencyId: b.agency.id,
        visitorId: b.visitor.id,
        eventName: "page_view",
        eventId: `evt-b-${suffix}`,
        consent: { essencial: true, analytics: true },
        occurredAt: new Date(),
      },
    });

    const eventsOfA = await prisma.trackingEvent.findMany({ where: { agencyId: a.agency.id } });
    const eventsOfB = await prisma.trackingEvent.findMany({ where: { agencyId: b.agency.id } });

    expect(eventsOfA.map((e) => e.eventId)).toEqual([`evt-a-${suffix}`]);
    expect(eventsOfB.map((e) => e.eventId)).toEqual([`evt-b-${suffix}`]);
  });

  it("a constraint @@unique([agencyId, eventId]) deduplica reenvio do mesmo evento", async () => {
    const { agency, visitor } = await createAgencyWithVisitor("gamma");
    const eventId = `evt-dedupe-${suffix}`;

    await prisma.trackingEvent.create({
      data: {
        agencyId: agency.id,
        visitorId: visitor.id,
        eventName: "page_view",
        eventId,
        consent: { essencial: true, analytics: true },
        occurredAt: new Date(),
      },
    });

    await expect(
      prisma.trackingEvent.create({
        data: {
          agencyId: agency.id,
          visitorId: visitor.id,
          eventName: "page_view",
          eventId,
          consent: { essencial: true, analytics: true },
          occurredAt: new Date(),
        },
      }),
    ).rejects.toThrow();

    const events = await prisma.trackingEvent.findMany({ where: { agencyId: agency.id, eventId } });
    expect(events).toHaveLength(1);
  });

  it("identificar um visitante vincula a um Lead existente pelo e-mail normalizado", async () => {
    const { agency, visitor } = await createAgencyWithVisitor("delta");
    const email = `pessoa-${suffix}@example.com`;
    const lead = await prisma.lead.create({ data: { agencyId: agency.id, name: "Pessoa Delta", email } });

    await prisma.trackingVisitor.update({ where: { id: visitor.id }, data: { leadId: lead.id } });

    const reloaded = await prisma.trackingVisitor.findUnique({ where: { id: visitor.id }, include: { lead: true } });
    expect(reloaded?.lead?.email).toBe(email);
  });

  it("consentimento é append-only: cada decisão nova cria uma linha, sem apagar a anterior", async () => {
    const { agency, visitor } = await createAgencyWithVisitor("epsilon");

    await prisma.trackingConsent.create({
      data: { agencyId: agency.id, visitorId: visitor.id, categories: ["ESSENCIAL"], noticeVersion: "v1" },
    });
    await prisma.trackingConsent.create({
      data: { agencyId: agency.id, visitorId: visitor.id, categories: ["ESSENCIAL", "ANALYTICS"], noticeVersion: "v1" },
    });

    const consents = await prisma.trackingConsent.findMany({
      where: { visitorId: visitor.id },
      orderBy: { createdAt: "asc" },
    });
    expect(consents).toHaveLength(2);
    expect(consents[0]?.categories).toEqual(["ESSENCIAL"]);
    expect(consents[1]?.categories).toEqual(["ESSENCIAL", "ANALYTICS"]);
  });
});
