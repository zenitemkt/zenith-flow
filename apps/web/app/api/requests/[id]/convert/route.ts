import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { prisma } from "@zenith/db";

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

  const req = await prisma.request.findUnique({ where: { id: params.id } });
  if (!req || req.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Demanda não encontrada." }, { status: 404 });
  }
  if (req.status !== "APROVADA") {
    return NextResponse.json(
      { error: "Só é possível converter demandas aprovadas." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const taskTitle = (typeof body?.taskTitle === "string" && body.taskTitle.trim()) || req.title;
  const projectId = typeof body?.projectId === "string" && body.projectId ? body.projectId : null;
  const newProjectName =
    typeof body?.newProjectName === "string" ? body.newProjectName.trim() : "";

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
      : await tx.project.create({
          data: { agencyId: membership.agencyId, clientId: req.clientId, name: newProjectName },
        });

    const createdTask = await tx.task.create({
      data: {
        projectId: project.id,
        title: taskTitle,
        description: req.description,
      },
    });
    await tx.taskStatusHistory.create({
      data: { taskId: createdTask.id, toStatus: "BACKLOG", actorUserId: session.user.id },
    });

    await tx.request.update({
      where: { id: req.id },
      data: { status: "CONVERTIDA", convertedTaskId: createdTask.id },
    });
    await tx.requestStatusHistory.create({
      data: {
        requestId: req.id,
        fromStatus: "APROVADA",
        toStatus: "CONVERTIDA",
        actorUserId: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "request.converted",
        resourceType: "request",
        resourceId: req.id,
        metadata: { taskId: createdTask.id, projectId: project.id },
      },
    });

    return createdTask;
  });

  return NextResponse.json({ taskId: task.id, projectId: task.projectId }, { status: 201 });
}
