import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { resolveCommentEntityClientId, type CommentEntityType } from "@/lib/comments";
import { getOrCreateTaskProject } from "@/lib/task-projects";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Seção 19 do manual: "mensagem pode virar tarefa apenas por usuário
 * autorizado". "Autorizado" aqui segue o mesmo critério usado em toda rota
 * interna do projeto desde a Release 1D parte 6: qualquer membro da equipe
 * da agência (não-cliente) — o manual não define papéis mais específicos
 * pra esta ação. A tarefa nasce sem responsável (cai em "Não atribuída" no
 * board) — quem converte não precisa decidir quem executa na hora.
 */
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

  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
    include: { thread: true },
  });
  if (!comment || comment.thread.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }
  if (comment.status === "REMOVIDO") {
    return NextResponse.json({ error: "Comentário removido não pode ser convertido." }, { status: 400 });
  }
  if (comment.convertedTaskId) {
    return NextResponse.json({ error: "Este comentário já foi convertido." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Informe um título." }, { status: 400 });
  }

  const assigneeUserId = typeof body?.assigneeUserId === "string" && body.assigneeUserId ? body.assigneeUserId : null;
  if (assigneeUserId) {
    const validAssignee = await prisma.membership.findFirst({
      where: { userId: assigneeUserId, agencyId: membership.agencyId, status: "ACTIVE", workspace: { kind: "AGENCY" } },
    });
    if (!validAssignee) {
      return NextResponse.json({ error: "Responsável inválido para esta agência." }, { status: 400 });
    }
  }

  const dueDateRaw = typeof body?.dueDate === "string" && body.dueDate ? body.dueDate : null;
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Prazo inválido." }, { status: 400 });
  }

  const clientId = await resolveCommentEntityClientId(comment.thread.entityType as CommentEntityType, comment.thread.entityId);

  const task = await prisma.$transaction(async (tx) => {
    const project = await getOrCreateTaskProject(tx, membership.agencyId, clientId);
    const createdTask = await tx.task.create({
      data: {
        projectId: project.id,
        title,
        description: comment.body,
        assigneeUserId,
        dueDate,
        originEntityType: comment.thread.entityType,
        originEntityId: comment.thread.entityId,
      },
    });
    await tx.taskStatusHistory.create({
      data: { taskId: createdTask.id, toStatus: "BACKLOG", actorUserId: session.user.id },
    });
    if (assigneeUserId) {
      await tx.taskAssignee.create({ data: { taskId: createdTask.id, userId: assigneeUserId, order: 0 } });
    }
    await tx.comment.update({ where: { id: comment.id }, data: { convertedTaskId: createdTask.id } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "comment.converted_to_task",
        resourceType: "comment",
        resourceId: comment.id,
        metadata: { taskId: createdTask.id },
      },
    });
    return createdTask;
  });

  return NextResponse.json({ taskId: task.id }, { status: 201 });
}
