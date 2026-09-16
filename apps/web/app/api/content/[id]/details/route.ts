import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Editar título e descrição de uma peça — não muda status nem histórico. */
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
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Informe o título." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.contentItem.update({
      where: { id: item.id },
      data: { title, description: description || null },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.details_updated",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { title, description: description || null },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
