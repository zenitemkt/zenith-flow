import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type RetentionPlanStatus } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

const VALID_STATUSES: RetentionPlanStatus[] = ["CONCLUIDO", "CANCELADO"];

/**
 * Só permite ATIVO -> CONCLUIDO/CANCELADO — mesma regra do manual "toda
 * recomendação precisa de... resultado": concluir sem `result` não é aceito.
 */
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

  const plan = await prisma.retentionPlan.findUnique({ where: { id: params.id } });
  if (!plan || plan.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  }
  if (plan.status !== "ATIVO") {
    return NextResponse.json({ error: "Este plano já foi encerrado." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as RetentionPlanStatus | undefined;
  const result = typeof body?.result === "string" ? body.result.trim() : "";

  if (!toStatus || !VALID_STATUSES.includes(toStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (toStatus === "CONCLUIDO" && !result) {
    return NextResponse.json({ error: "Registre o resultado ao concluir o plano." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.retentionPlan.update({
      where: { id: plan.id },
      data: { status: toStatus, result: result || plan.result },
    });
    await tx.retentionPlanStatusHistory.create({
      data: {
        planId: plan.id,
        fromStatus: plan.status,
        toStatus,
        note: result || null,
        actorUserId: session.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
