import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canTransitionContent } from "@/lib/content";
import { prisma, type ContentStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as ContentStatus | undefined;
  if (!toStatus || !canTransitionContent(item.status, toStatus)) {
    return NextResponse.json(
      { error: `Não é possível mudar de ${item.status} para ${toStatus}.` },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.contentItem.update({ where: { id: item.id }, data: { status: toStatus } });
    await tx.contentStatusHistory.create({
      data: {
        contentItemId: item.id,
        fromStatus: item.status,
        toStatus,
        actorUserId: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.status_changed",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { from: item.status, to: toStatus },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
