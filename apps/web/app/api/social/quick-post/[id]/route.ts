import { NextResponse } from "next/server";
import { prisma, type SocialPlatform, type SocialPostFormat } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { ScheduleError, scheduleContentPosts } from "@/lib/social-scheduling";
import { publishPostsNow } from "@/lib/social-publisher";
import { QUICK_POST_AUDIT_ACTION } from "@/lib/social-quick-post";

export const maxDuration = 60;

interface RouteParams {
  params: { id: string };
}

const FORMATS: SocialPostFormat[] = ["FEED", "REEL", "STORY"];

async function loadQuickPostItem(id: string) {
  const session = await getServerSession();
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) } as const;
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return { error: NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 }) } as const;
  }
  const item = await prisma.contentItem.findUnique({
    where: { id },
    select: { id: true, agencyId: true, status: true, _count: { select: { versions: true, socialPosts: true } } },
  });
  if (!item || item.agencyId !== membership.agencyId) {
    return { error: NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 }) } as const;
  }
  // Só peças criadas pela publicação direta podem pular a aprovação do cliente.
  const createdByQuickPost = await prisma.auditLog.findFirst({
    where: { agencyId: item.agencyId, resourceType: "content_item", resourceId: item.id, action: QUICK_POST_AUDIT_ACTION },
    select: { id: true },
  });
  if (!createdByQuickPost) {
    return { error: NextResponse.json({ error: "Esta peça não foi criada pelo Calendário." }, { status: 400 }) } as const;
  }
  return { session, item } as const;
}

/**
 * Publicação direta pelo Calendário — passo final: com a arte já na versão,
 * aprova a peça (quem agenda é a própria equipe) e agenda ou publica agora.
 * Body: { platforms, format, caption, publishAt (ISO) } ou { ..., now: true }.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const loaded = await loadQuickPostItem(params.id);
  if ("error" in loaded) return loaded.error;
  const { session, item } = loaded;
  if (item.status !== "PRODUCAO") {
    return NextResponse.json({ error: "Esta publicação já foi agendada." }, { status: 409 });
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

  // Aprova antes de agendar: scheduleContentPosts move Aprovado → Agendado.
  await prisma.$transaction([
    prisma.contentItem.update({ where: { id: item.id }, data: { status: "APROVADO" } }),
    prisma.contentStatusHistory.create({
      data: {
        contentItemId: item.id,
        fromStatus: "PRODUCAO",
        toStatus: "APROVADO",
        reason: "Publicação direta pelo Calendário (sem aprovação do cliente)",
        actorUserId: session.user.id,
      },
    }),
  ]);

  let ids: string[];
  try {
    ids = await scheduleContentPosts({ contentItemId: item.id, platforms, format, caption, publishAt, userId: session.user.id });
  } catch (error) {
    await prisma.contentItem.update({ where: { id: item.id }, data: { status: "PRODUCAO" } });
    if (error instanceof ScheduleError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  if (!now) return NextResponse.json({ ok: true, scheduled: ids.length }, { status: 201 });
  return NextResponse.json({ ok: true, outcomes: await publishPostsNow(ids) });
}

/**
 * Desfaz o passo 1 quando o envio da arte falha no meio — só enquanto a peça
 * ainda não tem nenhuma publicação. Sem permissão de admin: é o mesmo
 * usuário limpando o rascunho que acabou de criar.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const loaded = await loadQuickPostItem(params.id);
  if ("error" in loaded) return loaded.error;
  const { item } = loaded;
  if (item.status !== "PRODUCAO" || item._count.socialPosts > 0) {
    return NextResponse.json({ error: "Esta publicação já foi agendada." }, { status: 409 });
  }
  await prisma.contentItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
