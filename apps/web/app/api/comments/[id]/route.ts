import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

async function loadOwnedComment(id: string, agencyId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { thread: true },
  });
  if (!comment || comment.thread.agencyId !== agencyId) return null;
  return comment;
}

/** Editar — seção 19: "edição mantém histórico". Só o autor pode editar. */
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

  const comment = await loadOwnedComment(params.id, membership.agencyId);
  if (!comment) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }
  if (comment.authorUserId !== session.user.id) {
    return NextResponse.json({ error: "Só quem escreveu pode editar." }, { status: 403 });
  }
  if (comment.status === "REMOVIDO") {
    return NextResponse.json({ error: "Este comentário foi removido." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const newBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!newBody) {
    return NextResponse.json({ error: "O comentário não pode ficar vazio." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.commentEdit.create({
      data: { commentId: comment.id, previousBody: comment.body, editedByUserId: session.user.id },
    }),
    prisma.comment.update({
      where: { id: comment.id },
      data: { body: newBody, status: "EDITADO", editedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

/** Remover — tombstone (seção 19: "exclusão sensível vira tombstone"), não apaga a linha. */
export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const comment = await loadOwnedComment(params.id, membership.agencyId);
  if (!comment) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }
  if (comment.authorUserId !== session.user.id) {
    return NextResponse.json({ error: "Só quem escreveu pode remover." }, { status: 403 });
  }
  if (comment.status === "REMOVIDO") {
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction([
    prisma.commentEdit.create({
      data: { commentId: comment.id, previousBody: comment.body, editedByUserId: session.user.id },
    }),
    prisma.comment.update({
      where: { id: comment.id },
      data: { body: "", status: "REMOVIDO", editedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
