import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";
import { canSeeClient } from "@/lib/client-access";
import { parseChannels, parseFormats } from "@/lib/content-formats";
import { canKindUseStatus, isDesignKind, parseContentKind } from "@/lib/content-kind";

interface RouteParams {
  params: { id: string };
}

/** Editar título e descrição de uma peça — não muda status nem histórico. */
export async function POST(request: Request, { params }: RouteParams) {
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

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId || !(await canSeeClient(membership.agencyId, session.user.id, item.clientId))) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Informe o título." }, { status: 400 });
  }

  // Tipo opcional: sem `kind` no corpo, o cartão mantém o tipo atual.
  const kind = body?.kind === undefined ? item.kind : parseContentKind(body.kind);
  const design = isDesignKind(kind);
  if (kind !== item.kind && !canKindUseStatus(kind, item.status)) {
    return NextResponse.json(
      { error: "Para virar tarefa comum, o cartão precisa estar em A fazer, Fazendo ou Concluído." },
      { status: 400 },
    );
  }

  // Redes e formatos são opcionais aqui (quem só edita título/descrição não manda). Tarefa comum não tem.
  const channels = design ? parseChannels(body?.channels) : [];
  const formats = design ? parseFormats(body?.formats) : [];
  if (design && Array.isArray(body?.channels) && channels.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma rede." }, { status: 400 });
  }
  if (design && !isDesignKind(item.kind) && channels.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma rede para o cartão de design." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.contentItem.update({
      where: { id: item.id },
      data: {
        title,
        description: description || null,
        kind,
        ...(design && channels.length ? { channels, channel: channels[0] } : {}),
        ...(design && Array.isArray(body?.formats) ? { formats, format: formats[0] ?? null } : {}),
        ...(!design ? { channels: [], channel: "OUTRO" as const, formats: [], format: null } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.details_updated",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { title, description: description || null, kind, ...(channels.length ? { channels } : {}), ...(Array.isArray(body?.formats) ? { formats } : {}) },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
