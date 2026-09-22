import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Mover entre estágios do funil — só faz sentido enquanto a oportunidade está OPEN. */
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

  const opportunity = await prisma.opportunity.findUnique({ where: { id: params.id } });
  if (!opportunity || opportunity.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Oportunidade não encontrada." }, { status: 404 });
  }
  if (opportunity.status !== "OPEN") {
    return NextResponse.json({ error: "Só é possível mover oportunidades abertas." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const stageId = typeof body?.stageId === "string" ? body.stageId : "";
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage || stage.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Estágio inválido." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({ where: { id: opportunity.id }, data: { stageId: stage.id } });
    await tx.opportunityStatusHistory.create({
      data: {
        opportunityId: opportunity.id,
        fromStageId: opportunity.stageId,
        toStageId: stage.id,
        toStatus: "OPEN",
        actorUserId: session.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
