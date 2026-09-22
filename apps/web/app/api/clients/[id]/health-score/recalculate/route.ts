import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { computeHealthScore, HEALTH_SCORE_MODEL_VERSION } from "@/lib/health-score";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Recalcular sob demanda — seção 30.2 pede "recalcular por evento e job
 * diário de segurança"; sem apps/worker ainda, o botão manual é a peça que
 * um job futuro chamaria (mesmo padrão já usado em Rotinas).
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

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const { score, breakdown } = await computeHealthScore(membership.agencyId, client.id);

  const snapshot = await prisma.healthScoreSnapshot.create({
    data: {
      agencyId: membership.agencyId,
      clientId: client.id,
      score,
      modelVersion: HEALTH_SCORE_MODEL_VERSION,
      breakdown: breakdown as object,
      computedByUserId: session.user.id,
    },
  });

  return NextResponse.json({ id: snapshot.id, score }, { status: 201 });
}
