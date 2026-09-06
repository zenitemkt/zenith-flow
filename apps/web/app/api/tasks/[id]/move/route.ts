import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isBlockedByDependency, BOARD_LANES } from "@/lib/tasks";
import { advanceAssigneeQueue } from "@/lib/task-assignees";
import { prisma, type WorkItemStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Endpoint genérico usado pelo drag-and-drop entre colunas do board (o botão
 * "Iniciar"/"Concluir" no popup de detalhe usa /start e /complete
 * diretamente — este aqui só traduz "larguei o card na coluna X" pra uma das
 * mesmas transições).
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

  const body = await request.json().catch(() => null);
  const toLane = body?.toLane as WorkItemStatus | undefined;
  if (!toLane || !BOARD_LANES.includes(toLane)) {
    return NextResponse.json({ error: "Coluna inválida." }, { status: 400 });
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
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { status: "EM_ANDAMENTO" } });
      await tx.taskStatusHistory.create({
        data: { taskId: task.id, fromStatus: "BACKLOG", toStatus: "EM_ANDAMENTO", actorUserId: session.user.id },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (task.status === "EM_ANDAMENTO" && toLane === "BACKLOG") {
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { status: "BACKLOG" } });
      await tx.taskStatusHistory.create({
        data: { taskId: task.id, fromStatus: "EM_ANDAMENTO", toStatus: "BACKLOG", actorUserId: session.user.id },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (task.status === "EM_ANDAMENTO" && toLane === "CONCLUIDA") {
    const result = await prisma.$transaction((tx) => advanceAssigneeQueue(tx, task.id, session.user.id));
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Essa mudança de coluna não é permitida." }, { status: 400 });
}
