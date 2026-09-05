import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { computeChurnRisk, CHURN_RISK_MODEL_VERSION } from "@/lib/churn-risk";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

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

  const { score, band, signals } = await computeChurnRisk(membership.agencyId, client.id);

  const snapshot = await prisma.churnRiskSnapshot.create({
    data: {
      agencyId: membership.agencyId,
      clientId: client.id,
      score,
      band,
      modelVersion: CHURN_RISK_MODEL_VERSION,
      signals: signals as object,
      computedByUserId: session.user.id,
    },
  });

  return NextResponse.json({ id: snapshot.id, score, band }, { status: 201 });
}
