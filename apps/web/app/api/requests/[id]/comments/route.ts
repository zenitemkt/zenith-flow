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

  const existing = await prisma.request.findUnique({ where: { id: params.id } });
  if (!existing || existing.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Demanda não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!commentBody) {
    return NextResponse.json({ error: "Escreva algo para o comentário." }, { status: 400 });
  }

  await prisma.requestComment.create({
    data: { requestId: existing.id, authorUserId: session.user.id, body: commentBody },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
