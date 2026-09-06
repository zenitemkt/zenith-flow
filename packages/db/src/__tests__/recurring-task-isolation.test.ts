import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("recorrências: isolamento e idempotência por período", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.recurringTaskGeneration.deleteMany({ where: { template: { agencyId: { in: createdAgencyIds } } } });
    await prisma.recurringTaskTemplate.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithTemplate(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const template = await prisma.recurringTaskTemplate.create({
      data: { agencyId: agency.id, title: `Recorrência da ${label}`, recurrenceMode: "MENSAL", dayOfMonth: 1, status: "ATIVO" },
    });
    createdAgencyIds.push(agency.id);
    return { agency, template };
  }

  it("nunca retorna recorrências de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithTemplate("alpha");
    const b = await createAgencyWithTemplate("beta");

    const templatesOfA = await prisma.recurringTaskTemplate.findMany({ where: { agencyId: a.agency.id } });
    const templatesOfB = await prisma.recurringTaskTemplate.findMany({ where: { agencyId: b.agency.id } });

    expect(templatesOfA.map((t) => t.id)).toEqual([a.template.id]);
    expect(templatesOfB.map((t) => t.id)).toEqual([b.template.id]);
  });

  it("a constraint @@unique([templateId, period]) impede duas gerações do mesmo período", async () => {
    const { template } = await createAgencyWithTemplate("gamma");

    await prisma.recurringTaskGeneration.create({
      data: { templateId: template.id, period: "2026-09" },
    });

    await expect(
      prisma.recurringTaskGeneration.create({
        data: { templateId: template.id, period: "2026-09" },
      }),
    ).rejects.toThrow();

    const generations = await prisma.recurringTaskGeneration.findMany({ where: { templateId: template.id } });
    expect(generations).toHaveLength(1);
  });

  it("pausar a recorrência não apaga gerações já criadas", async () => {
    const { template } = await createAgencyWithTemplate("delta");
    await prisma.recurringTaskGeneration.create({
      data: { templateId: template.id, period: "2026-08" },
    });

    await prisma.recurringTaskTemplate.update({ where: { id: template.id }, data: { status: "PAUSADO" } });

    const generations = await prisma.recurringTaskGeneration.findMany({ where: { templateId: template.id } });
    expect(generations).toHaveLength(1);
  });
});
