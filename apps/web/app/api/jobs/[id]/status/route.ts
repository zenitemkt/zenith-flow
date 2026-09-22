import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { JOB_STATUS_TRANSITIONS } from "@/lib/hr-jobs";
import { prisma, type JobStatus } from "@zenite-mkt/db";

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

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job || job.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as JobStatus | undefined;
  if (!toStatus || !JOB_STATUS_TRANSITIONS[job.status]?.includes(toStatus)) {
    return NextResponse.json({ error: "Transição de status inválida." }, { status: 400 });
  }

  await prisma.job.update({ where: { id: job.id }, data: { status: toStatus } });

  return NextResponse.json({ ok: true });
}
