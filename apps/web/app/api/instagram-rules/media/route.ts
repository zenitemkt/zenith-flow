import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { decryptSecret } from "@/lib/crypto-secrets";
import { fetchRecentInstagramMedia } from "@/lib/instagram-automation";

/** Posts/reels recentes — pra regra de comentário presa a um post específico (Blueprint, seção 4.6). */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId") ?? "";
  const [facebook, instagram] = await Promise.all([
    prisma.socialConnection.findUnique({ where: { clientId_platform: { clientId, platform: "FACEBOOK" } } }),
    prisma.socialConnection.findUnique({ where: { clientId_platform: { clientId, platform: "INSTAGRAM" } } }),
  ]);
  if (!facebook || facebook.agencyId !== membership.agencyId || !instagram) {
    return NextResponse.json({ error: "Instagram não conectado pra este cliente." }, { status: 400 });
  }

  try {
    const media = await fetchRecentInstagramMedia(decryptSecret(facebook.accessTokenEnc), instagram.externalId);
    return NextResponse.json({ media });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao buscar posts." }, { status: 502 });
  }
}
