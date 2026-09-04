import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { generateRoutineRun } from "@/lib/routines";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Gatilho manual do período atual — em produção, um worker agendado (Fase
 * futura, `apps/worker`) chamaria essa mesma função todo dia, para toda
 * rotina ativa cujo dayOfMonth bateu com o dia de hoje. A idempotência por
 * templateId+período é a mesma nos dois casos.
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

  const template = await prisma.routineTemplate.findUnique({ where: { id: params.id } });
  if (!template || template.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Rotina não encontrada." }, { status: 404 });
  }

  const result = await generateRoutineRun(template.id, session.user.id);

  if (result.status === "not_active") {
    return NextResponse.json({ error: "Ative a rotina antes de gerar." }, { status: 400 });
  }

  return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
}
