import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { encryptSecret } from "@/lib/crypto-secrets";
import { fetchInstagramTokenIdentity, exchangeForLongLivedInstagramToken } from "@/lib/instagram-automation";

/**
 * Salva o token IGAA ("API do Instagram com Login do Instagram" — seção 4.1
 * do Blueprint, corrigido em 2026-10-23: é o único fluxo que entrega webhook
 * de mensagem/comentário, o token de Página não funciona pra isso). Gerado
 * manualmente no painel do app da Meta ("API do Instagram" → "Configuração
 * da API com login..." → "2. Gerar tokens de acesso") até termos um fluxo de
 * OAuth próprio.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) return NextResponse.json({ error: "Cole o token de acesso." }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  let identity;
  try {
    identity = await fetchInstagramTokenIdentity(accessToken);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Token inválido." }, { status: 400 });
  }

  let finalToken = accessToken;
  let expiresAt: Date | null = null;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (appSecret) {
    try {
      const longLived = await exchangeForLongLivedInstagramToken(accessToken, appSecret);
      finalToken = longLived.accessToken;
      expiresAt = new Date(Date.now() + longLived.expiresInSeconds * 1000);
    } catch {
      // Token colado pode já ser de longa duração, ou a troca falhar por outro motivo — guarda o que veio mesmo assim.
    }
  }

  await prisma.socialConnection.updateMany({
    where: { clientId, platform: "INSTAGRAM" },
    data: { messagingAccessTokenEnc: encryptSecret(finalToken), messagingAccountId: identity.id, messagingTokenExpiresAt: expiresAt },
  });

  return NextResponse.json({ ok: true, username: identity.username, longLived: Boolean(expiresAt), expiresAt });
}
