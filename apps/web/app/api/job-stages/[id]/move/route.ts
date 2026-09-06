import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Reordenar estágios de uma vaga — mesmo padrão de /api/pipeline-stages/:id/move, escopado por jobId em vez de agencyId. */
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

  const stage = await prisma.jobStage.findUnique({ where: { id: params.id }, include: { job: true } });
  if (!stage || stage.job.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Estágio não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const direction = body?.direction === "left" ? "left" : body?.direction === "right" ? "right" : null;
  if (!direction) {
    return NextResponse.json({ error: "Direção inválida." }, { status: 400 });
  }

  const neighborOrder = direction === "left" ? stage.order - 1 : stage.order + 1;
  const neighbor = await prisma.jobStage.findUnique({
    where: { jobId_order: { jobId: stage.jobId, order: neighborOrder } },
  });
  if (!neighbor) {
    return NextResponse.json({ error: "Já está na ponta." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.jobStage.update({ where: { id: stage.id }, data: { order: -1 } }),
    prisma.jobStage.update({ where: { id: neighbor.id }, data: { order: stage.order } }),
    prisma.jobStage.update({ where: { id: stage.id }, data: { order: neighborOrder } }),
  ]);

  return NextResponse.json({ ok: true });
}
