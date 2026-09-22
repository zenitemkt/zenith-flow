import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionEmployee } from "@/lib/employees";
import { prisma, type EmployeeStatus } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

const VALID_STATUSES: EmployeeStatus[] = ["ATIVO", "AFASTADO", "DESLIGADO"];

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

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee || employee.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as EmployeeStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!toStatus || !VALID_STATUSES.includes(toStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (!canTransitionEmployee(employee.status, toStatus)) {
    return NextResponse.json({ error: "Transição de status não permitida." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        status: toStatus,
        terminatedAt: toStatus === "DESLIGADO" ? new Date() : employee.terminatedAt,
      },
    });
    await tx.employeeStatusHistory.create({
      data: {
        employeeId: employee.id,
        fromStatus: employee.status,
        toStatus,
        reason,
        actorUserId: session.user.id,
      },
    });

    // Seção 20: "desligamento revoga sessões e preserva autoria histórica" —
    // revoga o acesso (sessões + suspende o Membership), mas nunca apaga o
    // User/Membership em si: Task.assigneeUserId, Comment.authorUserId etc.
    // continuam apontando pro mesmo userId, preservando a autoria.
    if (toStatus === "DESLIGADO" && employee.userId) {
      await tx.session.deleteMany({ where: { userId: employee.userId } });
      await tx.membership.updateMany({
        where: { userId: employee.userId, agencyId: membership.agencyId, status: "ACTIVE" },
        data: { status: "SUSPENDED" },
      });
    }

    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "employee.status_changed",
        resourceType: "employee",
        resourceId: employee.id,
        metadata: { fromStatus: employee.status, toStatus },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
