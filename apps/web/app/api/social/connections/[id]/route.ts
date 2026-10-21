import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";

interface RouteParams {
  params: { id: string };
}

/**
 * Desconectar: apaga o token e marca como revogada, mantendo o histórico de
 * publicações. Agendamentos pendentes nessa conta são cancelados.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const connection = await prisma.socialConnection.findUnique({ where: { id: params.id } });
  if (!connection || connection.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.socialConnection.update({
      where: { id: connection.id },
      data: { status: "REVOKED", accessTokenEnc: "", lastError: null },
    }),
    prisma.socialPost.updateMany({
      where: { connectionId: connection.id, status: { in: ["SCHEDULED", "PROCESSING"] } },
      data: { status: "CANCELED", lastError: "Conta desconectada." },
    }),
    prisma.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "social.disconnected",
        resourceType: "social_connection",
        resourceId: connection.id,
        metadata: { platform: connection.platform, name: connection.name },
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
