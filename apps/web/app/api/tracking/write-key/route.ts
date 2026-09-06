import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { generateTrackingWriteKey } from "@/lib/tracking-server";
import { prisma } from "@zenith/db";

/** Gera (ou rotaciona) a chave pública do coletor — invalida o snippet já publicado no site do cliente. */
export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const writeKey = generateTrackingWriteKey();
  await prisma.agency.update({ where: { id: membership.agencyId }, data: { trackingWriteKey: writeKey } });

  return NextResponse.json({ writeKey });
}
