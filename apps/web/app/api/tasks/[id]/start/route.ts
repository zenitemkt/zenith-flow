import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isBlockedByDependency } from "@/lib/tasks";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** "A Fazer" → "Fazendo" — botão "Iniciar" no popup de detalhe, ou drag-and-drop via /move. */
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

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: true, blockedBy: true },
  });
  if (!task || task.project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }
  if (task.status !== "BACKLOG") {
    return NextResponse.json({ error: "Só é possível iniciar tarefas em 'A Fazer'." }, { status: 400 });
  }
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
