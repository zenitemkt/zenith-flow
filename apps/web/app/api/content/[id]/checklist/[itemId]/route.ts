import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string; itemId: string };
}

async function loadItem(itemId: string, contentId: string, agencyId: string) {
  const item = await prisma.contentChecklistItem.findUnique({
    where: { id: itemId },
    include: { contentItem: true },
  });
  if (!item || item.contentItemId !== contentId || item.contentItem.agencyId !== agencyId) {
    return null;
  }
  return item;
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

  const item = await loadItem(params.itemId, params.id, membership.agencyId);
  if (!item) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const done = Boolean(body?.done);

  await prisma.contentChecklistItem.update({
    where: { id: item.id },
    data: { done, completedAt: done ? new Date() : null },
  });

  return NextResponse.json({ ok: true });
}

/** Remover um item do checklist (ex.: adicionado por engano). */
export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const item = await loadItem(params.itemId, params.id, membership.agencyId);
  if (!item) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  await prisma.contentChecklistItem.delete({ where: { id: item.id } });

  return NextResponse.json({ ok: true });
}
