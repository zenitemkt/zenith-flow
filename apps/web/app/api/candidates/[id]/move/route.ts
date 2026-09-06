import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Mover entre estágios do funil da vaga — só faz sentido enquanto o candidato está EM_ANDAMENTO. */
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

  const candidate = await prisma.candidate.findUnique({ where: { id: params.id } });
  if (!candidate || candidate.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
  }
  if (candidate.status !== "EM_ANDAMENTO") {
    return NextResponse.json({ error: "Só é possível mover candidatos em andamento." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const stageId = typeof body?.stageId === "string" ? body.stageId : "";
  const stage = await prisma.jobStage.findUnique({ where: { id: stageId } });
  if (!stage || stage.jobId !== candidate.jobId) {
    return NextResponse.json({ error: "Estágio inválido." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidate.update({ where: { id: candidate.id }, data: { stageId: stage.id } });
    await tx.candidateStatusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStageId: candidate.stageId,
        toStageId: stage.id,
        toStatus: "EM_ANDAMENTO",
        actorUserId: session.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
