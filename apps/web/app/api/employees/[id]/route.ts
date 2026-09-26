import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams { params: { id: string } }

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageTeam(membership.role)) return NextResponse.json({ error: "Apenas administradores podem excluir colaboradores." }, { status: 403 });

  const employee = await prisma.employee.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, name: true, userId: true } });
  if (!employee || employee.agencyId !== membership.agencyId) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (employee.userId) {
      await tx.session.deleteMany({ where: { userId: employee.userId } });
      await tx.membership.updateMany({ where: { userId: employee.userId, agencyId: membership.agencyId, status: "ACTIVE" }, data: { status: "SUSPENDED" } });
    }
    await tx.employee.delete({ where: { id: employee.id } });
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "employee.deleted", resourceType: "employee", resourceId: employee.id, metadata: { name: employee.name, accessRevoked: Boolean(employee.userId) } } });
  });
  return NextResponse.json({ ok: true });
}
