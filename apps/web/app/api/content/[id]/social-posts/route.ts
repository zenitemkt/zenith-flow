import { NextResponse } from "next/server";
import { prisma, type SocialPlatform, type SocialPostFormat } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { ScheduleError, parsePublishAtByPlatform, scheduleContentPosts } from "@/lib/social-scheduling";
import { publishPostsNow } from "@/lib/social-publisher";
import { canSeeClient } from "@/lib/client-access";

export const maxDuration = 60;

interface RouteParams {
  params: { id: string };
}

const FORMATS: SocialPostFormat[] = ["FEED", "REEL", "STORY"];

/**
 * Agendar ou publicar agora a peça nas redes conectadas do cliente.
 * Body: { platforms, format, caption, publishAt (ISO), publishAtByPlatform? (ISO por rede) }
 * ou { ..., now: true }.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, clientId: true } });
  if (!item || item.agencyId !== membership.agencyId || !(await canSeeClient(membership.agencyId, session.user.id, item.clientId))) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const platforms = (Array.isArray(body?.platforms) ? body.platforms : []).filter(
    (p: unknown): p is SocialPlatform => p === "INSTAGRAM" || p === "FACEBOOK",
  );
  const format = FORMATS.includes(body?.format) ? (body.format as SocialPostFormat) : "FEED";
  const caption = typeof body?.caption === "string" ? body.caption.trim() : "";
  const now = body?.now === true;
  const publishAt = now ? new Date() : new Date(typeof body?.publishAt === "string" ? body.publishAt : "");
  if (Number.isNaN(publishAt.getTime())) {
    return NextResponse.json({ error: "Escolha data e hora da publicação." }, { status: 400 });
  }

  let ids: string[];
  try {
    ids = await scheduleContentPosts({
      contentItemId: item.id,
      platforms,
      format,
      caption,
      publishAt,
      publishAtByPlatform: now ? undefined : parsePublishAtByPlatform(body?.publishAtByPlatform),
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof ScheduleError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const collaborators = (Array.isArray(body?.collaborators) ? body.collaborators : [])
    .map((x: unknown) => String(x).replace(/^@/, "").trim())
    .filter((x: string) => /^[A-Za-z0-9._]{1,30}$/.test(x))
    .slice(0, 3);
  const coverOffsetMs = body?.coverOffsetMs != null && body.coverOffsetMs !== "" && Number.isFinite(Number(body.coverOffsetMs)) ? Math.max(0, Math.round(Number(body.coverOffsetMs))) : null;
  const coverKey = typeof body?.coverKey === "string" && /^(drive:[A-Za-z0-9_-]{10,80}|[\w\/.-]{10,300})$/.test(body.coverKey) ? body.coverKey : null;
  const trialStrategy = body?.trialStrategy === "MANUAL" || body?.trialStrategy === "SS_PERFORMANCE" ? (body.trialStrategy as string) : null;
  if (collaborators.length || coverOffsetMs !== null || coverKey || trialStrategy) {
    await prisma.socialPost.updateMany({ where: { id: { in: ids }, platform: "INSTAGRAM" }, data: { collaborators, coverOffsetMs, coverKey, trialStrategy: format === "REEL" ? trialStrategy : null } });
  }

  if (!now) return NextResponse.json({ ok: true, scheduled: ids.length }, { status: 201 });

  // "Publicar agora": publica na hora, uma rede por vez, dentro do tempo da função.
  return NextResponse.json({ ok: true, outcomes: await publishPostsNow(ids) });
}
