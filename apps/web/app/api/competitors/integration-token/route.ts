import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getCurrentMembership, getServerSession } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { generateCompetitorAdsToken, hashCompetitorAdsToken } from "@/lib/competitor-ads";

async function authorize() {
  const session = await getServerSession();
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) return { error: NextResponse.json({ error: "Apenas administradores." }, { status: 403 }) };
  return { membership, userId: session.user.id };
}

export async function GET() {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const agency = await prisma.agency.findUnique({ where: { id: auth.membership.agencyId }, select: { competitorAdsTokenHash: true, competitorAdsTokenCreatedAt: true } });
  return NextResponse.json({ configured: Boolean(agency?.competitorAdsTokenHash), createdAt: agency?.competitorAdsTokenCreatedAt?.toISOString() ?? null });
}

/** Gera ou substitui o segredo. O valor puro só é devolvido nesta resposta. */
export async function POST() {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const token = generateCompetitorAdsToken();
  const now = new Date();
  await prisma.$transaction([
    prisma.agency.update({ where: { id: auth.membership.agencyId }, data: { competitorAdsTokenHash: hashCompetitorAdsToken(token), competitorAdsTokenCreatedAt: now } }),
    prisma.auditLog.create({ data: { agencyId: auth.membership.agencyId, actorUserId: auth.userId, actorType: "user", action: "competitor_ads.token_generated", resourceType: "agency", resourceId: auth.membership.agencyId } }),
  ]);
  return NextResponse.json({ token, createdAt: now.toISOString() });
}

export async function DELETE() {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  await prisma.$transaction([
    prisma.agency.update({ where: { id: auth.membership.agencyId }, data: { competitorAdsTokenHash: null, competitorAdsTokenCreatedAt: null } }),
    prisma.auditLog.create({ data: { agencyId: auth.membership.agencyId, actorUserId: auth.userId, actorType: "user", action: "competitor_ads.token_revoked", resourceType: "agency", resourceId: auth.membership.agencyId } }),
  ]);
  return NextResponse.json({ ok: true });
}

