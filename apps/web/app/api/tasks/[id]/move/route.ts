import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isBlockedByDependency, canActOnTask, BOARD_LANES } from "@/lib/tasks";
import { advanceAssigneeQueue } from "@/lib/task-assignees";
import { getOrCreateDefaultOperationStage } from "@/lib/operation-stages";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { prisma, type WorkItemStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Resolve a coluna customizável de destino — a informada (se for da agência) ou a primeira, criando-a se ainda não existir nenhuma. */
async function resolveStage(agencyId: string, requestedStageId: string | null) {
  if (requestedStageId) {
    const stage = await prisma.operationStage.findUnique({ where: { id: requestedStageId } });
    if (stage && stage.agencyId === agencyId) return stage;
  }
  return getOrCreateDefaultOperationStage(prisma, agencyId);
}

/**
 * Endpoint genérico usado pelo drag-and-drop entre colunas do board (o botão
 * "Iniciar"/"Concluir" no popup de detalhe usa /start e /complete
 * diretamente — este aqui só traduz "larguei o card na coluna X" pra uma das
 * mesmas transições, incluindo mover entre colunas customizáveis dentro do
 * balde "Fazendo" sem mudar `status`).
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

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: true, blockedBy: true },
  });
  if (!task || task.project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }
  if (!canActOnTask(membership.role, session.user.id, task)) {
    return NextResponse.json({ error: "Só quem está na vez (ou um admin) pode mover esta tarefa." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const toLane = body?.toLane as WorkItemStatus | undefined;
  const requestedStageId = typeof body?.stageId === "string" ? body.stageId : null;
  if (!toLane || !BOARD_LANES.includes(toLane)) {
    return NextResponse.json({ error: "Coluna inválida." }, { status: 400 });
  }

  if (toLane === "EM_ANDAMENTO" && task.status === "EM_ANDAMENTO") {
    const stage = await resolveStage(membership.agencyId, requestedStageId);
    if (task.stageId !== stage.id) {
      await prisma.task.update({ where: { id: task.id }, data: { stageId: stage.id } });
    }
    return NextResponse.json({ ok: true });
  }

  if (toLane === task.status) {
    return NextResponse.json({ ok: true });
  }

  if (task.status === "BACKLOG" && toLane === "EM_ANDAMENTO") {
    if (isBlockedByDependency("EM_ANDAMENTO", task.blockedBy?.status ?? null)) {
      return NextResponse.json(
        { error: `Esta tarefa depende de "${task.blockedBy!.title}", que ainda não foi concluída.` },
        { status: 409 },
      );
    }
    const stage = await resolveStage(membership.agencyId, requestedStageId);
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { status: "EM_ANDAMENTO", stageId: stage.id } });
      await tx.taskStatusHistory.create({
        data: { taskId: task.id, fromStatus: "BACKLOG", toStatus: "EM_ANDAMENTO", actorUserId: session.user.id },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (task.status === "EM_ANDAMENTO" && toLane === "BACKLOG") {
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { status: "BACKLOG", stageId: null } });
      await tx.taskStatusHistory.create({
        data: { taskId: task.id, fromStatus: "EM_ANDAMENTO", toStatus: "BACKLOG", actorUserId: session.user.id },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (task.status === "EM_ANDAMENTO" && toLane === "CONCLUIDA") {
    const result = await prisma.$transaction((tx) => advanceAssigneeQueue(tx, task.id, session.user.id));
    if (result.taskCompleted) {
      await fireWorkflowTrigger(membership.agencyId, "task.completed", "task", task.id, {
        taskId: task.id,
        title: task.title,
        clientId: task.project.clientId,
      });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Essa mudança de coluna não é permitida." }, { status: 400 });
}
