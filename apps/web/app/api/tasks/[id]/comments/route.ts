import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { loadCommentThreadView, getMentionableMembers } from "@/lib/comments";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Carrega a thread de comentários (histórico com data/hora) de uma tarefa. */
export async function GET(_request: Request, { params }: RouteParams) {
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

  const task = await prisma.task.findUnique({ where: { id: params.id }, include: { project: true } });
  if (!task || task.project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  const [thread, mentionableMembers] = await Promise.all([
    loadCommentThreadView("task", task.id),
    getMentionableMembers(membership.agencyId),
  ]);

  return NextResponse.json({ thread, mentionableMembers });
}
