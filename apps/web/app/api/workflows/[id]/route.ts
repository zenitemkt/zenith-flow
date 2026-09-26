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
  if (!canManageTeam(membership.role)) return NextResponse.json({ error: "Apenas administradores podem excluir automações." }, { status: 403 });

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, name: true } });
  if (!workflow || workflow.agencyId !== membership.agencyId) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.workflow.delete({ where: { id: workflow.id } });
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "workflow.deleted", resourceType: "workflow", resourceId: workflow.id, metadata: { name: workflow.name } } });
  });
  return NextResponse.json({ ok: true });
}
