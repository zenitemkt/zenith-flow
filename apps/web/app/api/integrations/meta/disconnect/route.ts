import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

/** Desconectar não apaga histórico nenhum (campanhas/métricas já lidas continuam) — só revoga a conexão local. */
export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const connection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } },
  });
  if (!connection) {
    return NextResponse.json({ error: "Nenhuma conexão da Meta encontrada." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.adAccountConnection.delete({ where: { id: connection.id } }),
    prisma.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "integration.disconnected",
        resourceType: "ad_account_connection",
        resourceId: connection.externalAccountId,
        metadata: { platform: "META" },
      },
    }),
  ]);

  return NextResponse.json({ disconnected: true });
}
