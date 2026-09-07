import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isValidWorkflowStep } from "@/lib/workflows";
import { prisma, Prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Salva a lista de passos do rascunho — só tem efeito enquanto `status = RASCUNHO` (ver docs/DECISIONS.md). */
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

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
  if (!workflow || workflow.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });
  }
  if (workflow.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Só é possível editar passos enquanto a automação está em rascunho." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const steps: unknown[] = Array.isArray(body?.steps) ? body.steps : [];
  if (!steps.every(isValidWorkflowStep)) {
    return NextResponse.json({ error: "Um ou mais passos estão incompletos." }, { status: 400 });
  }

  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { draftSteps: steps as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}
