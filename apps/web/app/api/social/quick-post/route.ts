import { NextResponse } from "next/server";
import { prisma, type SocialPlatform, type SocialPostFormat } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { CAPTION_MAX, PLATFORM_LABELS } from "@/lib/social-scheduling";
import { QUICK_POST_AUDIT_ACTION, QUICK_POST_FORMAT_LABEL, quickPostTitle, spDateOf } from "@/lib/social-quick-post";

const FORMATS: SocialPostFormat[] = ["FEED", "REEL", "STORY"];
/** Reenvio do mesmo formulário (duplo clique, rede lenta) em poucos segundos devolve a peça já criada. */
const DUPLICATE_WINDOW_MS = 15_000;

/**
 * Publicação direta pelo Calendário — passo 1: cria a peça (status Produção)
 * que vai receber a arte. Depois o navegador sobe os arquivos
 * (/api/content/[id]/media-upload + /versions) e confirma em
 * /api/social/quick-post/[id], que agenda ou publica.
 *
 * Body: { clientId, title?, platforms, format, caption, publishAt (ISO) }.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const platforms = [
    ...new Set(
      (Array.isArray(body?.platforms) ? body.platforms : []).filter(
        (p: unknown): p is SocialPlatform => p === "INSTAGRAM" || p === "FACEBOOK",
      ),
    ),
  ] as SocialPlatform[];
  const format = FORMATS.includes(body?.format) ? (body.format as SocialPostFormat) : "FEED";
  const caption = typeof body?.caption === "string" ? body.caption.trim() : "";
  const publishAt = new Date(typeof body?.publishAt === "string" ? body.publishAt : "");

  if (platforms.length === 0) return NextResponse.json({ error: "Escolha pelo menos uma rede." }, { status: 400 });
  if (caption.length > CAPTION_MAX) return NextResponse.json({ error: `A legenda passa de ${CAPTION_MAX} caracteres.` }, { status: 400 });
  if (Number.isNaN(publishAt.getTime())) return NextResponse.json({ error: "Escolha data e hora." }, { status: 400 });
  if (publishAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "Escolha uma data e hora no futuro (ou use Publicar agora)." }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  // Confere as conexões antes de criar a peça, pra não sobrar cartão pela metade.
  const connections = await prisma.socialConnection.findMany({
    where: { clientId: client.id, platform: { in: platforms }, status: "ACTIVE" },
    select: { platform: true },
  });
  const missing = platforms.filter((p) => !connections.some((c) => c.platform === p));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Conecte ${missing.map((p) => PLATFORM_LABELS[p]).join(" e ")} no perfil do cliente antes de agendar.` },
      { status: 400 },
    );
  }

  const date = spDateOf(publishAt);
  const title = quickPostTitle({ title: typeof body?.title === "string" ? body.title : "", caption, platforms, date });
  const channel = platforms.includes("INSTAGRAM") ? "INSTAGRAM" : "FACEBOOK";

  const item = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quick-post:${membership.agencyId}:${client.id}:${title}`}))`;
    const recent = await tx.contentItem.findFirst({
      where: {
        agencyId: membership.agencyId,
        clientId: client.id,
        title,
        channel,
        status: "PRODUCAO",
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return recent;

    const created = await tx.contentItem.create({
      data: {
        agencyId: membership.agencyId,
        clientId: client.id,
        title,
        channel,
        format: QUICK_POST_FORMAT_LABEL[format],
        caption: caption || null,
        scheduledDate: new Date(`${date}T00:00:00.000Z`),
        status: "PRODUCAO",
        assigneeUserIds: [session.user.id],
      },
    });
    await tx.contentStatusHistory.create({
      data: {
        contentItemId: created.id,
        toStatus: "PRODUCAO",
        reason: "Criado pelo Calendário (publicação direta)",
        actorUserId: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: QUICK_POST_AUDIT_ACTION,
        resourceType: "content_item",
        resourceId: created.id,
        metadata: { platforms, format, publishAt: publishAt.toISOString() },
      },
    });
    return created;
  });

  return NextResponse.json({ id: item.id }, { status: 201 });
}
