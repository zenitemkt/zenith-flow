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
  if (!canManageTeam(membership.role)) return NextResponse.json({ error: "Apenas administradores podem excluir vagas." }, { status: 403 });

  const job = await prisma.job.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, title: true } });
  if (!job || job.agencyId !== membership.agencyId) return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.job.delete({ where: { id: job.id } });
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "job.deleted", resourceType: "job", resourceId: job.id, metadata: { title: job.title } } });
  });
  return NextResponse.json({ ok: true });
}
