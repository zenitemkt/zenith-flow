import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isValidWorkflowStep } from "@/lib/workflows";
import { prisma, Prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * "Publicar cria versão imutável; workflow em rascunho não executa" (seção
 * 40). Governança simplificada nesta fatia: sem ramificação (não há ciclo
 * possível) e sem ação de canal com credencial (e-mail/WhatsApp), a validação
 * fica em "tem pelo menos 1 passo válido" — o resto da lista de governança do
 * manual (canais, consentimento, credenciais, volume) não se aplica a este
 * conjunto de ações. Ver docs/DECISIONS.md.
 */
export async function POST(_request: Request, { params }: RouteParams) {
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
    return NextResponse.json({ error: "Esta automação já foi publicada." }, { status: 400 });
  }

  const steps = workflow.draftSteps as unknown[];
  if (!Array.isArray(steps) || steps.length === 0 || !steps.every(isValidWorkflowStep)) {
    return NextResponse.json({ error: "Adicione pelo menos um passo válido antes de publicar." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: 1,
        steps: workflow.draftSteps as Prisma.InputJsonValue,
        publishedByUserId: session.user.id,
      },
    });
    await tx.workflow.update({ where: { id: workflow.id }, data: { status: "ATIVO" } });
  });

  return NextResponse.json({ ok: true });
}
