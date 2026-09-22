import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isCommentEntityType, resolveCommentableEntity } from "@/lib/comments";
import { prisma } from "@zenite-mkt/db";

/**
 * Cria (ou reaproveita) a thread de uma entidade e adiciona um comentário —
 * seção 19 do manual: "/:entity/:id/comments". Uma rota genérica em vez de
 * uma por módulo — o mesmo endpoint atende qualquer entityType suportado.
 */
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
  const entityType = body?.entityType;
  const entityId = typeof body?.entityId === "string" ? body.entityId : "";
  const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
  const mentionedUserIds: string[] = Array.isArray(body?.mentionedUserIds)
    ? body.mentionedUserIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (!isCommentEntityType(entityType) || !entityId) {
    return NextResponse.json({ error: "Entidade inválida." }, { status: 400 });
  }
  if (!commentBody) {
    return NextResponse.json({ error: "Escreva algo para o comentário." }, { status: 400 });
  }

  const ownsEntity = await resolveCommentableEntity(entityType, entityId, membership.agencyId);
  if (!ownsEntity) {
    return NextResponse.json({ error: "Entidade não encontrada." }, { status: 404 });
  }

  const comment = await prisma.$transaction(async (tx) => {
    const thread = await tx.commentThread.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: { agencyId: membership.agencyId, entityType, entityId },
      update: {},
    });

    const created = await tx.comment.create({
      data: { threadId: thread.id, authorUserId: session.user.id, body: commentBody },
    });

    if (mentionedUserIds.length > 0) {
      await tx.commentMention.createMany({
        data: mentionedUserIds.map((mentionedUserId) => ({
          commentId: created.id,
          mentionedUserId,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({ id: comment.id }, { status: 201 });
}
