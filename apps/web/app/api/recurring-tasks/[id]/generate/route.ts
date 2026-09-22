import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { generateRecurringTaskRun } from "@/lib/recurring-tasks";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** "Gerar agora" — gatilho manual, mesmo padrão de tudo que dependeria de apps/worker (ainda não existe). */
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

  const template = await prisma.recurringTaskTemplate.findUnique({ where: { id: params.id } });
  if (!template || template.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Recorrência não encontrada." }, { status: 404 });
  }

  const result = await generateRecurringTaskRun(template.id, session.user.id);
  if (result.status === "not_active") {
    return NextResponse.json({ error: "Esta recorrência não está ativa." }, { status: 400 });
  }

  return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
}
