import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole, canApproveTimesheets } from "@/lib/rbac";
import { canTransitionTimesheet } from "@/lib/timesheets";
import { prisma, type TimesheetStatus } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

const VALID_STATUSES: TimesheetStatus[] = ["ENVIADA", "APROVADA", "CORRIGIDA"];
/** Transições que só quem aprova (gestor) pode fazer — o dono só envia/reenvia. */
const MANAGER_ONLY: TimesheetStatus[] = ["APROVADA", "CORRIGIDA"];

export async function POST(request: Request, { params }: RouteParams) {
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

  const timesheet = await prisma.timesheet.findUnique({ where: { id: params.id } });
  if (!timesheet || timesheet.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Folha não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as TimesheetStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!toStatus || !VALID_STATUSES.includes(toStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (!canTransitionTimesheet(timesheet.status, toStatus)) {
    return NextResponse.json({ error: "Transição de status não permitida." }, { status: 400 });
  }

  const isOwner = timesheet.userId === session.user.id;
  const isManager = canApproveTimesheets(membership.role);

  if (MANAGER_ONLY.includes(toStatus)) {
    if (!isManager) {
      return NextResponse.json({ error: "Seu papel não pode aprovar/corrigir folhas." }, { status: 403 });
    }
  } else if (!isOwner) {
    return NextResponse.json({ error: "Só o dono da folha pode enviá-la." }, { status: 403 });
  }
  if (toStatus === "CORRIGIDA" && !reason) {
    return NextResponse.json({ error: "Descreva o motivo da correção pedida." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.timesheet.update({
      where: { id: timesheet.id },
      data: {
        status: toStatus,
        submittedAt: toStatus === "ENVIADA" ? new Date() : timesheet.submittedAt,
        approvedByUserId: toStatus === "APROVADA" ? session.user.id : timesheet.approvedByUserId,
        approvedAt: toStatus === "APROVADA" ? new Date() : timesheet.approvedAt,
      },
    });
    await tx.timesheetStatusHistory.create({
      data: {
        timesheetId: timesheet.id,
        fromStatus: timesheet.status,
        toStatus,
        reason,
        actorUserId: session.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
