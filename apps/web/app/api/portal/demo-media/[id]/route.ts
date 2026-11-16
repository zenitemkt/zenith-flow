import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { signContentMediaRead } from "@/lib/content-media-server";
import { driveMediaResponse } from "@/lib/social-drive";
import { isDemoEmail, isDemoSourceMedia } from "@/lib/portal-demo";

interface RouteParams {
  params: { id: string };
}

/** Imagem de uma arte da Zenite para ilustrar o painel de demonstração. Só para logins demo e só artes da Zenite. */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session || !isDemoEmail(session.user.email)) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isClientRole(membership.role)) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  const client = await prisma.client.findUnique({ where: { workspaceId: membership.workspaceId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });

  const media = await isDemoSourceMedia(params.id, membership.agencyId, client.id);
  if (!media) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  if (media.driveFileId) return driveMediaResponse(membership.agencyId, media.driveFileId, media.contentType);
  return NextResponse.redirect(await signContentMediaRead(media.key));
}
