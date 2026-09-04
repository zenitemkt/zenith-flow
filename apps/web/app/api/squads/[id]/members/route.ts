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

  const squad = await prisma.squad.findUnique({ where: { id: params.id } });
  if (!squad || squad.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Squad não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "Escolha uma pessoa." }, { status: 400 });
  }

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

  const existing = await prisma.squadMember.findUnique({
    where: { squadId_userId: { squadId: squad.id, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Esta pessoa já está no squad." }, { status: 409 });
  }

  await prisma.squadMember.create({ data: { squadId: squad.id, userId } });

  return NextResponse.json({ ok: true }, { status: 201 });
}
