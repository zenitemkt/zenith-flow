import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canActOnTask } from "@/lib/tasks";
import { closeCurrentRun } from "@/lib/task-timer";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * "Fazendo" → "A Fazer" — botão "Pausar" no popup de detalhe. Fecha o
 * cronômetro (ver `closeCurrentRun`) e lança as horas trabalhadas no trecho,
 * mas mantém a fila de responsáveis intacta (quem estava na vez continua na
 * vez; só quem estava "rodando" vai precisar clicar Iniciar de novo).
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
  if (task.status !== "EM_ANDAMENTO") {
    return NextResponse.json({ error: "Só é possível pausar tarefas em 'Fazendo'." }, { status: 400 });
  }
  if (!canActOnTask(membership.role, session.user.id, task)) {
    return NextResponse.json({ error: "Só quem está na vez (ou um admin) pode pausar esta tarefa." }, { status: 403 });
  }

  const timer = await prisma.$transaction(async (tx) => {
    const result = await closeCurrentRun(tx, task, membership.agencyId);
    await tx.task.update({ where: { id: task.id }, data: { status: "BACKLOG", stageId: null } });
    await tx.taskStatusHistory.create({
      data: {
        taskId: task.id,
        fromStatus: "EM_ANDAMENTO",
        toStatus: "BACKLOG",
        reason: "Pausada",
        actorUserId: session.user.id,
      },
    });
    return result;
  });

  return NextResponse.json({ ok: true, ...timer });
}
