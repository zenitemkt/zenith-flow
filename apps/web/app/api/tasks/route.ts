import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { prisma } from "@zenith/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const blockedByTaskId =
    typeof body?.blockedByTaskId === "string" && body.blockedByTaskId ? body.blockedByTaskId : null;

  if (!title) {
    return NextResponse.json({ error: "Informe o título da tarefa." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Projeto inválido." }, { status: 400 });
  }

  if (blockedByTaskId) {
    const blocker = await prisma.task.findUnique({ where: { id: blockedByTaskId } });
    if (!blocker || blocker.projectId !== project.id) {
      return NextResponse.json({ error: "Tarefa bloqueadora inválida." }, { status: 400 });
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: { projectId: project.id, title, description, blockedByTaskId },
    });
    await tx.taskStatusHistory.create({
      data: { taskId: created.id, toStatus: "BACKLOG", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "task.created",
        resourceType: "task",
        resourceId: created.id,
      },
    });
    return created;
  });

  return NextResponse.json({ id: task.id }, { status: 201 });
}
