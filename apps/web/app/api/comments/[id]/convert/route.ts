import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { resolveCommentEntityClientId, type CommentEntityType } from "@/lib/comments";
import { createRequestRecord } from "@/lib/requests-create";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Seção 19 do manual: "mensagem pode virar demanda/tarefa apenas por
 * usuário autorizado". "Autorizado" aqui segue o mesmo critério usado em
 * toda rota interna do projeto desde a Release 1D parte 6: qualquer membro
 * da equipe da agência (não-cliente) — o manual não define papéis mais
 * específicos pra esta ação.
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
  if (comment.convertedTaskId || comment.convertedRequestId) {
    return NextResponse.json({ error: "Este comentário já foi convertido." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const target = body?.target === "task" ? "task" : body?.target === "request" ? "request" : null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!target) {
    return NextResponse.json({ error: "Escolha converter em tarefa ou demanda." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "Informe um título." }, { status: 400 });
  }

  const clientId = await resolveCommentEntityClientId(comment.thread.entityType as CommentEntityType, comment.thread.entityId);

  if (target === "request") {
    const req = await createRequestRecord({
      agencyId: membership.agencyId,
      clientId,
      title,
      description: comment.body,
      requesterName: "Convertido de um comentário",
      requestedByUserId: session.user.id,
    });
    await prisma.comment.update({ where: { id: comment.id }, data: { convertedRequestId: req.id } });
    return NextResponse.json({ requestId: req.id }, { status: 201 });
  }

  const projectId = typeof body?.projectId === "string" && body.projectId ? body.projectId : null;
  const newProjectName = typeof body?.newProjectName === "string" ? body.newProjectName.trim() : "";
  if (!projectId && !newProjectName) {
    return NextResponse.json(
      { error: "Escolha um projeto existente ou informe o nome de um novo." },
      { status: 400 },
    );
  }
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Projeto inválido." }, { status: 400 });
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const project = projectId
      ? { id: projectId }
      : await tx.project.create({ data: { agencyId: membership.agencyId, clientId, name: newProjectName } });

    const createdTask = await tx.task.create({
      data: { projectId: project.id, title, description: comment.body },
    });
    await tx.taskStatusHistory.create({
      data: { taskId: createdTask.id, toStatus: "BACKLOG", actorUserId: session.user.id },
    });
    await tx.comment.update({ where: { id: comment.id }, data: { convertedTaskId: createdTask.id } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "comment.converted_to_task",
        resourceType: "comment",
        resourceId: comment.id,
        metadata: { taskId: createdTask.id, projectId: project.id },
      },
    });
    return createdTask;
  });

  return NextResponse.json({ taskId: task.id, projectId: task.projectId }, { status: 201 });
}
