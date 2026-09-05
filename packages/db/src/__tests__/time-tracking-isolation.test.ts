import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("apontamento: isolamento, idempotência de folha e correção com histórico", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.timeEntryEdit.deleteMany({
      where: { timeEntry: { agencyId: { in: createdAgencyIds } } },
    });
    await prisma.timeEntry.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.timesheetStatusHistory.deleteMany({
      where: { timesheet: { agencyId: { in: createdAgencyIds } } },
    });
    await prisma.timesheet.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna apontamentos de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");
    const weekStart = new Date("2026-09-07T00:00:00.000Z");

    const sheetA = await prisma.timesheet.create({
      data: { agencyId: a.id, userId: "user-a", weekStart },
    });
    const sheetB = await prisma.timesheet.create({
      data: { agencyId: b.id, userId: "user-b", weekStart },
    });
    await prisma.timeEntry.create({
      data: { agencyId: a.id, userId: "user-a", timesheetId: sheetA.id, date: weekStart, minutes: 60 },
    });
    await prisma.timeEntry.create({
      data: { agencyId: b.id, userId: "user-b", timesheetId: sheetB.id, date: weekStart, minutes: 90 },
    });

    const entriesOfA = await prisma.timeEntry.findMany({ where: { agencyId: a.id } });
    const entriesOfB = await prisma.timeEntry.findMany({ where: { agencyId: b.id } });

    expect(entriesOfA.map((e) => e.minutes)).toEqual([60]);
    expect(entriesOfB.map((e) => e.minutes)).toEqual([90]);
  });

  it("uma pessoa só tem uma folha por semana (@@unique userId+weekStart)", async () => {
    const agency = await createAgency("gamma");
    const weekStart = new Date("2026-09-07T00:00:00.000Z");

    await prisma.timesheet.create({ data: { agencyId: agency.id, userId: "user-gamma", weekStart } });

    await expect(
      prisma.timesheet.create({ data: { agencyId: agency.id, userId: "user-gamma", weekStart } }),
    ).rejects.toThrow();
  });

  it("editar um apontamento de folha já enviada grava motivo e reabre como CORRIGIDA", async () => {
    const agency = await createAgency("delta");
    const weekStart = new Date("2026-09-07T00:00:00.000Z");
    const sheet = await prisma.timesheet.create({
      data: { agencyId: agency.id, userId: "user-delta", weekStart, status: "ENVIADA" },
    });
    const entry = await prisma.timeEntry.create({
      data: { agencyId: agency.id, userId: "user-delta", timesheetId: sheet.id, date: weekStart, minutes: 120 },
    });

    // Simula o que a rota PATCH /api/time-entries/:id faz quando a folha já foi enviada.
    await prisma.$transaction([
      prisma.timeEntryEdit.create({
        data: { timeEntryId: entry.id, previousMinutes: entry.minutes, reason: "Apontei errado", editedByUserId: "user-delta" },
      }),
      prisma.timeEntry.update({ where: { id: entry.id }, data: { minutes: 90 } }),
      prisma.timesheet.update({ where: { id: sheet.id }, data: { status: "CORRIGIDA" } }),
      prisma.timesheetStatusHistory.create({
        data: { timesheetId: sheet.id, fromStatus: "ENVIADA", toStatus: "CORRIGIDA", reason: "Apontei errado", actorUserId: "user-delta" },
      }),
    ]);

    const reloadedEntry = await prisma.timeEntry.findUnique({ where: { id: entry.id }, include: { edits: true } });
    const reloadedSheet = await prisma.timesheet.findUnique({ where: { id: sheet.id } });

    expect(reloadedEntry?.minutes).toBe(90);
    expect(reloadedEntry?.edits).toHaveLength(1);
    expect(reloadedEntry?.edits[0]!.previousMinutes).toBe(120);
    expect(reloadedEntry?.edits[0]!.reason).toBe("Apontei errado");
    expect(reloadedSheet?.status).toBe("CORRIGIDA");
  });
});
