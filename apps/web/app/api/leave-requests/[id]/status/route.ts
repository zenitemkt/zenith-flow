import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionLeave } from "@/lib/employees";
import { prisma, type LeaveRequestStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

const VALID_STATUSES: LeaveRequestStatus[] = ["APROVADA", "REJEITADA", "REALIZADA"];

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

  const leave = await prisma.leaveRequest.findUnique({ where: { id: params.id } });
  if (!leave || leave.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as LeaveRequestStatus | undefined;
  const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;

  if (!toStatus || !VALID_STATUSES.includes(toStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (!canTransitionLeave(leave.status, toStatus)) {
    return NextResponse.json({ error: "Transição de status não permitida." }, { status: 400 });
  }
  if (toStatus === "REJEITADA" && !rejectionReason) {
    return NextResponse.json({ error: "Informe o motivo da rejeição." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: toStatus,
        rejectionReason: toStatus === "REJEITADA" ? rejectionReason : leave.rejectionReason,
        decidedByUserId: session.user.id,
        decidedAt: new Date(),
      },
    });
    await tx.leaveRequestStatusHistory.create({
      data: {
        leaveRequestId: leave.id,
        fromStatus: leave.status,
        toStatus,
        reason: rejectionReason,
        actorUserId: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "leave_request.status_changed",
        resourceType: "leave_request",
        resourceId: leave.id,
        metadata: { fromStatus: leave.status, toStatus },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
