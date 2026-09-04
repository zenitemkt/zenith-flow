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

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!commentBody) {
    return NextResponse.json({ error: "Escreva algo para o comentário." }, { status: 400 });
  }

  await prisma.contentComment.create({
    data: { contentItemId: item.id, authorUserId: session.user.id, body: commentBody },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
