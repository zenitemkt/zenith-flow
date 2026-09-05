import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { startOfWeekUTC, roundMinutes } from "@/lib/timesheets";
import { prisma, type TimeEntrySource } from "@zenith/db";

const VALID_SOURCES: TimeEntrySource[] = ["MANUAL", "TIMER"];

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const dateRaw = typeof body?.date === "string" ? body.date : "";
  const rawMinutes = Number(body?.minutes);
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const taskId = typeof body?.taskId === "string" ? body.taskId : null;
  const source = (body?.source as TimeEntrySource | undefined) ?? "MANUAL";

  const date = new Date(dateRaw);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }
  if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
    return NextResponse.json({ error: "Informe a duração em minutos." }, { status: 400 });
  }
  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 400 });
  }

  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
    if (!task || task.project.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
    }
  }

  const minutes = roundMinutes(rawMinutes);
  const weekStart = startOfWeekUTC(date);

  const entry = await prisma.$transaction(async (tx) => {
    const timesheet = await tx.timesheet.upsert({
      where: { userId_weekStart: { userId: session.user.id, weekStart } },
      create: { agencyId: membership.agencyId, userId: session.user.id, weekStart },
      update: {},
    });

    if (timesheet.status !== "RASCUNHO" && timesheet.status !== "CORRIGIDA") {
      throw new Error("TIMESHEET_LOCKED");
    }

    return tx.timeEntry.create({
      data: {
        agencyId: membership.agencyId,
        userId: session.user.id,
        taskId,
        timesheetId: timesheet.id,
        date,
        minutes,
        description,
        source,
      },
    });
  }).catch((err) => {
    if (err instanceof Error && err.message === "TIMESHEET_LOCKED") return null;
    throw err;
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Esta semana já foi enviada — peça correção antes de apontar mais horas." },
      { status: 409 },
    );
  }

  return NextResponse.json({ id: entry.id }, { status: 201 });
}
