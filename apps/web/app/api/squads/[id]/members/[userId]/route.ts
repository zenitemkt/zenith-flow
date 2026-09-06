import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string; userId: string };
}

/** Remover alguém do squad não apaga nada além do vínculo — tarefas atribuídas, carga histórica e alocações de cliente continuam intactas. */
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

  const squad = await prisma.squad.findUnique({ where: { id: params.id } });
  if (!squad || squad.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Squad não encontrado." }, { status: 404 });
  }

  const member = await prisma.squadMember.findUnique({
    where: { squadId_userId: { squadId: squad.id, userId: params.userId } },
  });
  if (!member) {
    return NextResponse.json({ error: "Esta pessoa não está no squad." }, { status: 404 });
  }

  await prisma.squadMember.delete({ where: { id: member.id } });

  return NextResponse.json({ ok: true });
}
