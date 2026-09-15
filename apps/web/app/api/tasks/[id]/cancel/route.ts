import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canActOnTask } from "@/lib/tasks";
import { closeCurrentRun } from "@/lib/task-timer";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Cancelar exige motivo, mesmo padrão de Lead/Oportunidade/Financeiro. */
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

  const task = await prisma.task.findUnique({ where: { id: params.id }, include: { project: true } });
  if (!task || task.project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }
  if (task.status === "CONCLUIDA" || task.status === "CANCELADA") {
    return NextResponse.json({ error: "Esta tarefa já está encerrada." }, { status: 400 });
  }
  if (!canActOnTask(membership.role, session.user.id, task)) {
    return NextResponse.json({ error: "Só quem está na vez (ou um admin) pode mover esta tarefa." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "Informe o motivo do cancelamento." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await closeCurrentRun(tx, task, membership.agencyId);
    await tx.task.update({ where: { id: task.id }, data: { status: "CANCELADA", stageId: null } });
    await tx.taskStatusHistory.create({
      data: { taskId: task.id, fromStatus: task.status, toStatus: "CANCELADA", reason, actorUserId: session.user.id },
    });
  });

  return NextResponse.json({ ok: true });
}
