import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { advanceAssigneeQueue } from "@/lib/task-assignees";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Concluir a parte de quem está na vez. Se há próximo na fila, a tarefa
 * volta pra "A Fazer" sob o próximo responsável; senão, fecha como
 * CONCLUIDA. Ver `advanceAssigneeQueue` (lib/task-assignees.ts).
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
    return NextResponse.json({ error: "Só é possível concluir tarefas em 'Fazendo'." }, { status: 400 });
  }

  const result = await prisma.$transaction((tx) => advanceAssigneeQueue(tx, task.id, session.user.id));

  return NextResponse.json(result);
}
