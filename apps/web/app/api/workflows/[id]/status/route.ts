import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionWorkflow } from "@/lib/workflows";
import { prisma, type WorkflowStatus } from "@zenith/db";

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

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
  if (!workflow || workflow.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.status as WorkflowStatus | undefined;
  if (!toStatus || !canTransitionWorkflow(workflow.status, toStatus)) {
    return NextResponse.json({ error: "Transição de status inválida." }, { status: 400 });
  }

  await prisma.workflow.update({ where: { id: workflow.id }, data: { status: toStatus } });

  return NextResponse.json({ ok: true });
}
