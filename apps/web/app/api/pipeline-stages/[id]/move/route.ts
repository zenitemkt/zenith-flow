import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Reordenar estágios do funil — troca de posição com o vizinho imediato (esquerda/direita), nunca um salto arbitrário. */
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

  const stage = await prisma.pipelineStage.findUnique({ where: { id: params.id } });
  if (!stage || stage.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Estágio não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const direction = body?.direction === "left" ? "left" : body?.direction === "right" ? "right" : null;
  if (!direction) {
    return NextResponse.json({ error: "Direção inválida." }, { status: 400 });
  }

  const neighborOrder = direction === "left" ? stage.order - 1 : stage.order + 1;
  const neighbor = await prisma.pipelineStage.findUnique({
    where: { agencyId_order: { agencyId: membership.agencyId, order: neighborOrder } },
  });
  if (!neighbor) {
    return NextResponse.json({ error: "Já está na ponta." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.pipelineStage.update({ where: { id: stage.id }, data: { order: -1 } }),
    prisma.pipelineStage.update({ where: { id: neighbor.id }, data: { order: stage.order } }),
    prisma.pipelineStage.update({ where: { id: stage.id }, data: { order: neighborOrder } }),
  ]);

  return NextResponse.json({ ok: true });
}
