import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { encryptSecret } from "@/lib/crypto-secrets";
import { META_OAUTH_SCOPES } from "@/lib/meta-ads";
import { META_OAUTH_PENDING_COOKIE, decodeMetaOAuthPending } from "@/lib/meta-oauth-pending";

/**
 * Passo 2 da conexão quando `/me/adaccounts` devolveu mais de uma conta (ver
 * `oauth/callback`) — o usuário escolheu qual conectar em
 * `/traqueamento/conexoes`; aqui é onde a conexão de fato é gravada.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(META_OAUTH_PENDING_COOKIE)?.value;
  const pending = cookieValue ? decodeMetaOAuthPending(cookieValue) : null;
  if (!pending || pending.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Sessão de conexão expirada — conecte de novo." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : null;
  const account = pending.candidates.find((candidate) => candidate.id === accountId);
  if (!account) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.adAccountConnection.upsert({
      where: { agencyId_platform: { agencyId: pending.agencyId, platform: "META" } },
      create: {
        agencyId: pending.agencyId,
        platform: "META",
        externalAccountId: account.id,
        externalAccountName: account.name,
        accessTokenEnc: encryptSecret(pending.accessToken),
        tokenExpiresAt: pending.tokenExpiresAt ? new Date(pending.tokenExpiresAt) : null,
        scopes: [...META_OAUTH_SCOPES],
        status: "ACTIVE",
        lastValidatedAt: new Date(),
        connectedByUserId: pending.connectedByUserId,
      },
      update: {
        externalAccountId: account.id,
        externalAccountName: account.name,
        accessTokenEnc: encryptSecret(pending.accessToken),
        tokenExpiresAt: pending.tokenExpiresAt ? new Date(pending.tokenExpiresAt) : null,
        scopes: [...META_OAUTH_SCOPES],
        status: "ACTIVE",
        lastError: null,
        lastValidatedAt: new Date(),
        connectedByUserId: pending.connectedByUserId,
      },
    }),
    prisma.auditLog.create({
      data: {
        agencyId: pending.agencyId,
        actorUserId: membership.userId,
        actorType: "user",
        action: "integration.connected",
        resourceType: "ad_account_connection",
        resourceId: account.id,
        metadata: { platform: "META", accountName: account.name, chosenFromCandidates: pending.candidates.length },
      },
    }),
  ]);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(META_OAUTH_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
