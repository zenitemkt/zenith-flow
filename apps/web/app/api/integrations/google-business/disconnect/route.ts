import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

export async function POST() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores podem desconectar." }, { status: 403 });
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { agencyId: membership.agencyId }, select: { id: true } });
  if (!connection) return NextResponse.json({ ok: true });
  await prisma.$transaction([
    prisma.googleBusinessConnection.delete({ where: { id: connection.id } }),
    prisma.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "integration.disconnected", resourceType: "google_business_connection", resourceId: connection.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
