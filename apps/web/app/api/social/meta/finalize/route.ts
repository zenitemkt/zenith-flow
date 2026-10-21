import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { encryptSecret } from "@/lib/crypto-secrets";
import { fetchMetaPages } from "@/lib/meta-social";
import { SOCIAL_OAUTH_PENDING_COOKIE, decodeSocialOAuthPending } from "@/lib/social-oauth-pending";

/** Liga a Página escolhida (e o Instagram vinculado a ela) ao cliente. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const pending = decodeSocialOAuthPending(cookies().get(SOCIAL_OAUTH_PENDING_COOKIE)?.value);
  const body = await request.json().catch(() => null);
  const pageId = typeof body?.pageId === "string" ? body.pageId : "";
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const includeInstagram = body?.includeInstagram !== false;

  if (
    !pending ||
    pending.agencyId !== membership.agencyId ||
    pending.userId !== session.user.id ||
    pending.clientId !== clientId
  ) {
    return NextResponse.json({ error: "A autorização expirou. Clique em Conectar de novo." }, { status: 400 });
  }

  const pages = await fetchMetaPages(pending.userAccessToken);
  const page = pages.find((p) => p.id === pageId);
  if (!page) return NextResponse.json({ error: "Página não encontrada nesta autorização." }, { status: 400 });

  const tokenEnc = encryptSecret(page.accessToken);
  const base = { agencyId: membership.agencyId, clientId, accessTokenEnc: tokenEnc, status: "ACTIVE" as const, lastError: null, connectedByUserId: session.user.id };

  await prisma.$transaction(async (tx) => {
    await tx.socialConnection.upsert({
      where: { clientId_platform: { clientId, platform: "FACEBOOK" } },
      create: { ...base, platform: "FACEBOOK", externalId: page.id, name: page.name, pictureUrl: page.pictureUrl },
      update: { ...base, externalId: page.id, name: page.name, pictureUrl: page.pictureUrl },
    });
    if (page.instagram && includeInstagram) {
      await tx.socialConnection.upsert({
        where: { clientId_platform: { clientId, platform: "INSTAGRAM" } },
        create: {
          ...base,
          platform: "INSTAGRAM",
          externalId: page.instagram.id,
          name: page.instagram.username ? `@${page.instagram.username}` : page.name,
          username: page.instagram.username,
          pictureUrl: page.instagram.pictureUrl,
        },
        update: {
          ...base,
          externalId: page.instagram.id,
          name: page.instagram.username ? `@${page.instagram.username}` : page.name,
          username: page.instagram.username,
          pictureUrl: page.instagram.pictureUrl,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "social.connected",
        resourceType: "client",
        resourceId: clientId,
        metadata: { pageId: page.id, pageName: page.name, instagram: page.instagram?.username ?? null },
      },
    });
  });

  const response = NextResponse.json({ ok: true, instagram: Boolean(page.instagram && includeInstagram) });
  response.cookies.delete(SOCIAL_OAUTH_PENDING_COOKIE);
  return response;
}
