import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { DEFAULT_JOB_STAGE_NAMES } from "@/lib/hr-jobs";
import { prisma } from "@zenith/db";

/** Seção 20: "vaga recebe pipeline configurável" — cada Job semeia seu próprio funil, mesmo padrão do Pipeline comercial. */
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
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const positionId = typeof body?.positionId === "string" && body.positionId ? body.positionId : null;
  if (!title) {
    return NextResponse.json({ error: "Informe o título da vaga." }, { status: 400 });
  }

  if (positionId) {
    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    }
  }

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: { agencyId: membership.agencyId, title, description, positionId },
    });
    await tx.jobStage.createMany({
      data: DEFAULT_JOB_STAGE_NAMES.map((name, order) => ({ jobId: created.id, name, order })),
    });
    return created;
  });

  return NextResponse.json({ id: job.id }, { status: 201 });
}
