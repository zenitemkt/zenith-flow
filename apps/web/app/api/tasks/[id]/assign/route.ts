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

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!task || task.project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;

  if (userId) {
    const targetMembership = await prisma.membership.findFirst({
      where: {
        userId,
        agencyId: membership.agencyId,
        status: "ACTIVE",
        workspace: { kind: "AGENCY" },
      },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "Pessoa inválida para esta agência." }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: task.id }, data: { assigneeUserId: userId } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "task.reassigned",
        resourceType: "task",
        resourceId: task.id,
        metadata: { from: task.assigneeUserId, to: userId },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
