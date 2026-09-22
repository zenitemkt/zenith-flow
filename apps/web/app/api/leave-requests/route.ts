import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type LeaveType } from "@zenite-mkt/db";

const VALID_TYPES: LeaveType[] = ["FERIAS", "AUSENCIA"];

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
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
  const type = body?.type as LeaveType | undefined;
  const startDateRaw = typeof body?.startDate === "string" ? body.startDate : "";
  const endDateRaw = typeof body?.endDate === "string" ? body.endDate : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  const startDate = new Date(startDateRaw);
  const endDate = new Date(endDateRaw);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
    return NextResponse.json({ error: "Datas inválidas." }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.create({
      data: {
        agencyId: membership.agencyId,
        employeeId: employee.id,
        type,
        startDate,
        endDate,
        reason,
        requestedByUserId: session.user.id,
      },
    });
    await tx.leaveRequestStatusHistory.create({
      data: { leaveRequestId: leave.id, toStatus: "SOLICITADA", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "leave_request.created",
        resourceType: "leave_request",
        resourceId: leave.id,
        metadata: { employeeId: employee.id, type },
      },
    });
    return leave;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
