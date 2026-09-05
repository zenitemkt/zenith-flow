import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { roundMinutes } from "@/lib/timesheets";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Editar um apontamento — seção 21: "correção posterior guarda autor e
 * motivo". Enquanto a folha ainda é rascunho, edição é livre (nada foi
 * revisado ainda). Se a folha já foi enviada ou aprovada, editar exige motivo
 * e volta a folha pra CORRIGIDA — a pessoa precisa reenviar pra reaprovação.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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

  const entry = await prisma.timeEntry.findUnique({ where: { id: params.id }, include: { timesheet: true } });
  if (!entry || entry.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Apontamento não encontrado." }, { status: 404 });
  }
  if (entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Você só pode editar seus próprios apontamentos." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rawMinutes = Number(body?.minutes);
  const description = typeof body?.description === "string" ? body.description.trim() || null : entry.description;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
    return NextResponse.json({ error: "Informe a duração em minutos." }, { status: 400 });
  }

  const needsReason = entry.timesheet.status === "ENVIADA" || entry.timesheet.status === "APROVADA";
  if (needsReason && !reason) {
    return NextResponse.json(
      { error: "Esta folha já foi enviada — descreva o motivo da correção." },
      { status: 400 },
    );
  }

  const minutes = roundMinutes(rawMinutes);

  await prisma.$transaction(async (tx) => {
    await tx.timeEntryEdit.create({
      data: { timeEntryId: entry.id, previousMinutes: entry.minutes, reason, editedByUserId: session.user.id },
    });
    await tx.timeEntry.update({ where: { id: entry.id }, data: { minutes, description } });

    if (needsReason) {
      await tx.timesheet.update({ where: { id: entry.timesheet.id }, data: { status: "CORRIGIDA" } });
      await tx.timesheetStatusHistory.create({
        data: {
          timesheetId: entry.timesheet.id,
          fromStatus: entry.timesheet.status,
          toStatus: "CORRIGIDA",
          reason,
          actorUserId: session.user.id,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
