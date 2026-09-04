import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("rotinas: isolamento e idempotência por período", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.routineRun.deleteMany({ where: { template: { agencyId: { in: createdAgencyIds } } } });
    await prisma.routineTemplateTask.deleteMany({
      where: { template: { agencyId: { in: createdAgencyIds } } },
    });
    await prisma.routineTemplate.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithTemplate(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const template = await prisma.routineTemplate.create({
      data: { agencyId: agency.id, name: `Rotina da ${label}`, status: "ATIVO", dayOfMonth: 1 },
    });
    createdAgencyIds.push(agency.id);
    return { agency, template };
  }

  it("nunca retorna rotinas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithTemplate("alpha");
    const b = await createAgencyWithTemplate("beta");

    const routinesOfA = await prisma.routineTemplate.findMany({ where: { agencyId: a.agency.id } });
    const routinesOfB = await prisma.routineTemplate.findMany({ where: { agencyId: b.agency.id } });

    expect(routinesOfA.map((r) => r.id)).toEqual([a.template.id]);
    expect(routinesOfB.map((r) => r.id)).toEqual([b.template.id]);
  });

  it("a constraint @@unique([templateId, period]) impede duas gerações do mesmo período", async () => {
    const { template } = await createAgencyWithTemplate("gamma");

    await prisma.routineRun.create({
      data: { templateId: template.id, period: "2026-09", status: "CRIADA" },
    });

    await expect(
      prisma.routineRun.create({
        data: { templateId: template.id, period: "2026-09", status: "CRIADA" },
      }),
    ).rejects.toThrow();

    const runs = await prisma.routineRun.findMany({ where: { templateId: template.id } });
    expect(runs).toHaveLength(1);
  });

  it("pausar a rotina não apaga gerações já criadas", async () => {
    const { template } = await createAgencyWithTemplate("delta");
    await prisma.routineRun.create({
      data: { templateId: template.id, period: "2026-08", status: "CRIADA" },
    });

    await prisma.routineTemplate.update({ where: { id: template.id }, data: { status: "PAUSADO" } });

    const runs = await prisma.routineRun.findMany({ where: { templateId: template.id } });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("CRIADA");
  });
});
