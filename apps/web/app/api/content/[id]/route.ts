import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Excluir uma peça inteira (card) — remove versões, aprovações, checklist, histórico e comentários junto. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (!canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem excluir conteúdos." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.commentThread.deleteMany({ where: { entityType: "content_item", entityId: item.id } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.deleted",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { title: item.title },
      },
    });
    await tx.contentItem.delete({ where: { id: item.id } });
  });

  return NextResponse.json({ ok: true });
}
