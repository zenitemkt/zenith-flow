import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { decryptSecret } from "@/lib/crypto-secrets";
import { subscribeInstagramWebhook } from "@/lib/instagram-automation";

/**
 * "Ativar automação" pra um cliente — liga o webhook do app na Página dele
 * (passo por Página, seção 4.1 do Blueprint: o webhook só configurado no
 * painel do app não basta, cada Página precisa assinar).
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const [facebook, instagram] = await Promise.all([
    prisma.socialConnection.findUnique({ where: { clientId_platform: { clientId, platform: "FACEBOOK" } } }),
    prisma.socialConnection.findUnique({ where: { clientId_platform: { clientId, platform: "INSTAGRAM" } } }),
  ]);
  if (!facebook || facebook.agencyId !== membership.agencyId || !instagram) {
    return NextResponse.json({ error: "Conecte o Facebook/Instagram deste cliente antes (aba Conexões do agendador)." }, { status: 400 });
  }

  try {
    await subscribeInstagramWebhook(decryptSecret(facebook.accessTokenEnc), facebook.externalId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível ativar — confira se a Página tem as permissões de mensagem (reconecte se precisar)." },
      { status: 502 },
    );
  }
}
