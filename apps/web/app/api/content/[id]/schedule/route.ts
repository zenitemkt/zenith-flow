import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

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
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const raw = typeof body?.scheduledDate === "string" ? body.scheduledDate.trim() : "";
  const scheduledDate = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(scheduledDate?.getTime())) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.contentItem.update({ where: { id: item.id }, data: { scheduledDate } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.scheduled_date_changed",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { scheduledDate: scheduledDate ? scheduledDate.toISOString() : null },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
