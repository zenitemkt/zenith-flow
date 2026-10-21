import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { signContentMediaRead } from "@/lib/content-media-server";

interface RouteParams {
  params: { id: string };
}

/** Link estável de um arquivo da arte — redireciona pra URL assinada (bucket privado). */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });

  const media = await prisma.contentVersionMedia.findUnique({
    where: { id: params.id },
    select: {
      key: true,
      version: { select: { contentItem: { select: { agencyId: true, client: { select: { workspaceId: true } } } } } },
    },
  });
  const item = media?.version.contentItem;
  if (!media || !item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  // Cliente no portal só vê a arte dos próprios conteúdos.
  if (isClientRole(membership.role) && item.client.workspaceId !== membership.workspaceId) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  return NextResponse.redirect(await signContentMediaRead(media.key));
}
