import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionWorkItem, isBlockedByDependency } from "@/lib/tasks";
import { prisma, type WorkItemStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

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
  const toStatus = body?.toStatus as WorkItemStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

  if (!toStatus || !canTransitionWorkItem(task.status, toStatus)) {
    return NextResponse.json(
      { error: `Não é possível mudar de ${task.status} para ${toStatus}.` },
      { status: 400 },
    );
  }
  if (isBlockedByDependency(toStatus, task.blockedBy?.status ?? null)) {
    return NextResponse.json(
      { error: `Esta tarefa depende de "${task.blockedBy!.title}", que ainda não foi concluída.` },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: toStatus,
        completedAt: toStatus === "CONCLUIDA" ? new Date() : task.completedAt,
      },
    });
    await tx.taskStatusHistory.create({
      data: {
        taskId: task.id,
        fromStatus: task.status,
        toStatus,
        reason,
        actorUserId: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "task.status_changed",
        resourceType: "task",
        resourceId: task.id,
        metadata: { from: task.status, to: toStatus },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
