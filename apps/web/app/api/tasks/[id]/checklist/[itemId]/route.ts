import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string; itemId: string };
}

/** Marcar/desmarcar um item do checklist. */
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

  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: params.itemId },
    include: { task: { include: { project: true } } },
  });
  if (!item || item.taskId !== params.id || item.task.project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const done = Boolean(body?.done);

  await prisma.taskChecklistItem.update({
    where: { id: item.id },
    data: { done, completedAt: done ? new Date() : null },
  });

  return NextResponse.json({ ok: true });
}
