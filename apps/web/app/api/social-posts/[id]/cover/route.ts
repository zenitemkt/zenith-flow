import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { signContentMediaRead } from "@/lib/content-media-server";
import { driveIdOfKey, driveMediaResponse } from "@/lib/social-drive";

/** Mostra a capa já escolhida de uma publicação agendada (Drive ou R2). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const post = await prisma.socialPost.findUnique({ where: { id: params.id }, select: { agencyId: true, clientId: true, coverKey: true } });
  if (!post?.coverKey || post.agencyId !== membership.agencyId || !(await canSeeClient(membership.agencyId, session.user.id, post.clientId))) {
    return NextResponse.json({ error: "Capa não encontrada." }, { status: 404 });
  }
  const driveId = driveIdOfKey(post.coverKey);
  if (driveId) return driveMediaResponse(post.agencyId, driveId, "image/jpeg");
  return NextResponse.redirect(await signContentMediaRead(post.coverKey, 300));
}
