import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { advanceAssigneeQueue } from "@/lib/task-assignees";
import { canActOnTask } from "@/lib/tasks";
import { closeCurrentRun } from "@/lib/task-timer";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Concluir a parte de quem está na vez. Se há próximo na fila, a tarefa
 * volta pra "A Fazer" sob o próximo responsável; senão, fecha como
 * CONCLUIDA. Ver `advanceAssigneeQueue` (lib/task-assignees.ts).
 *
 * Aceita tanto "Fazendo" quanto "A Fazer" (pedido do usuário, 2026-09-11):
 * às vezes a tarefa vai direto de "A Fazer" pra concluída, sem passar por
 * "Fazendo" — nesse caso não há cronômetro aberto pra fechar (`closeCurrentRun`
 * simplesmente não faz nada) e nenhuma hora é lançada.
 */
export async function POST(_request: Request, { params }: RouteParams) {
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
  if (task.status !== "EM_ANDAMENTO" && task.status !== "BACKLOG") {
    return NextResponse.json(
      { error: "Só é possível concluir tarefas em 'A Fazer' ou 'Fazendo'." },
      { status: 400 },
    );
  }
  if (!canActOnTask(membership.role, session.user.id, task)) {
    return NextResponse.json({ error: "Só quem está na vez (ou um admin) pode mover esta tarefa." }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await closeCurrentRun(tx, task, membership.agencyId);
    return advanceAssigneeQueue(tx, task.id, session.user.id);
  });

  if (result.taskCompleted) {
    await fireWorkflowTrigger(membership.agencyId, "task.completed", "task", task.id, {
      taskId: task.id,
      title: task.title,
      clientId: task.project.clientId,
    });
  }

  return NextResponse.json(result);
}
