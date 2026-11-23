import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type ContentChannel } from "@zenite-mkt/db";
import { canSeeClient } from "@/lib/client-access";
import { parseChannels, parseFormats } from "@/lib/content-formats";
import { isDesignKind, parseContentKind } from "@/lib/content-kind";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Janela em que um cartão idêntico (mesmo cliente, canal e título) é tratado como reenvio. */
const DUPLICATE_WINDOW_MS = 15_000;

const VALID_CHANNELS: ContentChannel[] = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "YOUTUBE", "OUTRO"];

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const title = optionalString(body?.title);
  const clientId = optionalString(body?.clientId);
  // Tipo do cartão: só Design tem redes/formatos/legenda/campanha (2026-11-22).
  const kind = parseContentKind(body?.kind);
  const design = isDesignKind(kind);
  // Várias redes e formatos num cartão só; `channel`/`format` (um só) continuam aceitos.
  // Tarefa comum não tem rede: grava OUTRO só porque a coluna é obrigatória.
  const channels = design ? parseChannels(body?.channels) : [];
  const channel = (design ? (channels[0] ?? body?.channel) : "OUTRO") as ContentChannel | undefined;
  const formats = design ? parseFormats(body?.formats) : [];
  const format = design ? (formats[0] ?? optionalString(body?.format)) : null;

  if (!title) {
    return NextResponse.json({ error: "Informe o título da peça." }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Escolha o cliente." }, { status: 400 });
  }
  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Escolha um canal válido." }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.agencyId !== membership.agencyId || !(await canSeeClient(membership.agencyId, session.user.id, client.id))) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const scheduledDateRaw = optionalString(body?.scheduledDate);
  const scheduledDate = scheduledDateRaw ? new Date(scheduledDateRaw) : null;

  const assigneeUserIds = Array.isArray(body?.assigneeUserIds)
    ? body.assigneeUserIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (assigneeUserIds.length > 0) {
    const validMembers = await prisma.membership.count({
      where: { agencyId: membership.agencyId, status: "ACTIVE", userId: { in: assigneeUserIds } },
    });
    if (validMembers !== new Set(assigneeUserIds).size) {
      return NextResponse.json({ error: "Responsável inválido para esta agência." }, { status: 400 });
    }
  }

  const item = await prisma.$transaction(async (tx) => {
    // Idempotência no servidor: reenvio (duplo clique, duas abas, retry de rede)
    // do mesmo cartão em poucos segundos devolve o já criado em vez de duplicar.
    // O lock por (agência, cliente, título, canal) serializa requisições
    // simultâneas — sem ele, as duas passariam pela checagem antes de qualquer insert.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`content:${membership.agencyId}:${clientId}:${channel}:${title}`}))`;
    const recentDuplicate = await tx.contentItem.findFirst({
      where: {
        agencyId: membership.agencyId,
        clientId,
        channel,
        title,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recentDuplicate) return recentDuplicate;

    const created = await tx.contentItem.create({
      data: {
        agencyId: membership.agencyId,
        clientId,
        title,
        description: optionalString(body?.description),
        kind,
        channel,
        channels: design ? (channels.length ? channels : [channel]) : [],
        format,
        formats: formats.length ? formats : format ? [format] : [],
        campaign: design ? optionalString(body?.campaign) : null,
        caption: design ? optionalString(body?.caption) : null,
        scheduledDate,
        assigneeUserIds,
      },
    });
    await tx.contentStatusHistory.create({
      data: { contentItemId: created.id, toStatus: "IDEIA", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.created",
        resourceType: "content_item",
        resourceId: created.id,
        metadata: { kind },
      },
    });
    return created;
  });

  return NextResponse.json({ id: item.id }, { status: 201 });
}
