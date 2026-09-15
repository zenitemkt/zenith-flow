import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type ContentChannel } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

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
  const channel = body?.channel as ContentChannel | undefined;

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
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const scheduledDateRaw = optionalString(body?.scheduledDate);
  const scheduledDate = scheduledDateRaw ? new Date(scheduledDateRaw) : null;

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.contentItem.create({
      data: {
        agencyId: membership.agencyId,
        clientId,
        title,
        description: optionalString(body?.description),
        channel,
        format: optionalString(body?.format),
        campaign: optionalString(body?.campaign),
        caption: optionalString(body?.caption),
        scheduledDate,
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
      },
    });
    return created;
  });

  return NextResponse.json({ id: item.id }, { status: 201 });
}
