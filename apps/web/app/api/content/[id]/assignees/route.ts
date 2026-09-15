import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
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
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const assigneeUserIds = Array.isArray(body?.assigneeUserIds)
    ? body.assigneeUserIds.filter((id: unknown): id is string => typeof id === "string")
    : null;
  if (!assigneeUserIds) {
    return NextResponse.json({ error: "Lista de responsáveis inválida." }, { status: 400 });
  }

  if (assigneeUserIds.length > 0) {
    const validMembers = await prisma.membership.count({
      where: { agencyId: membership.agencyId, status: "ACTIVE", userId: { in: assigneeUserIds } },
    });
    if (validMembers !== new Set(assigneeUserIds).size) {
      return NextResponse.json({ error: "Responsável inválido para esta agência." }, { status: 400 });
    }
  }

  await prisma.contentItem.update({ where: { id: item.id }, data: { assigneeUserIds } });

  return NextResponse.json({ ok: true });
}
