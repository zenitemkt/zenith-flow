import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { getOrCreateDefaultOperationStage } from "@/lib/operation-stages";
import { prisma } from "@zenith/db";

/** Cria uma nova coluna customizável no balde "Fazendo" do board de Operação (pedido do usuário, 2026-09-07). */
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Dê um nome à coluna." }, { status: 400 });
  }

  // Garante que já existe pelo menos uma coluna antes de calcular a próxima posição.
  await getOrCreateDefaultOperationStage(prisma, membership.agencyId);

  const last = await prisma.operationStage.findFirst({
    where: { agencyId: membership.agencyId },
    orderBy: { order: "desc" },
  });

  const stage = await prisma.operationStage.create({
    data: { agencyId: membership.agencyId, name, order: (last?.order ?? -1) + 1 },
  });

  return NextResponse.json({ id: stage.id }, { status: 201 });
}
