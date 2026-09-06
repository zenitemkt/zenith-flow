import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

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
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  if (!name) {
    return NextResponse.json({ error: "Informe o nome do candidato." }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
  }

  const firstStage = await prisma.jobStage.findFirst({ where: { jobId: job.id }, orderBy: { order: "asc" } });
  if (!firstStage) {
    return NextResponse.json({ error: "Esta vaga não tem estágios configurados." }, { status: 400 });
  }

  const candidate = await prisma.$transaction(async (tx) => {
    const created = await tx.candidate.create({
      data: { agencyId: membership.agencyId, jobId: job.id, stageId: firstStage.id, name, email, phone },
    });
    await tx.candidateStatusHistory.create({
      data: {
        candidateId: created.id,
        toStageId: firstStage.id,
        toStatus: "EM_ANDAMENTO",
        actorUserId: session.user.id,
      },
    });
    return created;
  });

  return NextResponse.json({ id: candidate.id }, { status: 201 });
}
