import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { publishSocialPostNow } from "@/lib/social-publisher";
import { canSeeClient } from "@/lib/client-access";

export const maxDuration = 60;

interface RouteParams {
  params: { id: string };
}

/**
 * Depois de reagendar: a peça vai para o dia da próxima publicação pendente
 * (assim o cartão também muda de dia no Calendário) e volta a "Agendado" se
 * tinha ficado em "Aprovado" (ex.: todas as redes canceladas antes).
 */
async function syncContentDate(contentItemId: string, userId: string) {
  const next = await prisma.socialPost.findFirst({
    where: { contentItemId, status: { in: ["SCHEDULED", "PUBLISHING", "PROCESSING"] } },
    orderBy: { publishAt: "asc" },
    select: { publishAt: true },
  });
  if (!next) return;
  // scheduledDate é a data (meia-noite UTC) do dia em São Paulo.
  const spDay = new Date(next.publishAt.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const item = await prisma.contentItem.findUnique({ where: { id: contentItemId }, select: { status: true } });
  if (!item) return;
  await prisma.contentItem.update({
    where: { id: contentItemId },
    data: { scheduledDate: new Date(`${spDay}T00:00:00.000Z`), ...(item.status === "APROVADO" ? { status: "AGENDADO" } : {}) },
  });
  if (item.status === "APROVADO") {
    await prisma.contentStatusHistory.create({
      data: { contentItemId, fromStatus: "APROVADO", toStatus: "AGENDADO", reason: "Publicação reagendada", actorUserId: userId },
    });
  }
}

/**
 * Ações num post: `cancel` (agendado → cancelado), `retry` (falhou → publica
 * agora) e `reschedule` (nova data, com `publishAt`).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }
  const post = await prisma.socialPost.findUnique({ where: { id: params.id } });
  if (!post || post.agencyId !== membership.agencyId || !(await canSeeClient(membership.agencyId, session.user.id, post.clientId))) {
    return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const audit = (name: string, metadata: Record<string, unknown> = {}) =>
    prisma.auditLog.create({
      data: {
        agencyId: post.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: `social_post.${name}`,
        resourceType: "social_post",
        resourceId: post.id,
        metadata: { platform: post.platform, ...metadata },
      },
    });

  if (action === "cancel") {
    const result = await prisma.socialPost.updateMany({
      where: { id: post.id, status: { in: ["SCHEDULED", "FAILED"] } },
      data: { status: "CANCELED" },
    });
    if (result.count === 0) return NextResponse.json({ error: "Esta publicação não pode mais ser cancelada." }, { status: 409 });
    await audit("canceled");
    return NextResponse.json({ ok: true });
  }

  if (action === "reschedule") {
    const publishAt = new Date(typeof body?.publishAt === "string" ? body.publishAt : "");
    if (Number.isNaN(publishAt.getTime()) || publishAt.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "Escolha uma data e hora no futuro." }, { status: 400 });
    }
    const result = await prisma.socialPost.updateMany({
      where: { id: post.id, status: { in: ["SCHEDULED", "FAILED", "CANCELED"] } },
      // O container do Instagram expira em 24h: reagendado, recria a mídia na hora de publicar.
      data: { status: "SCHEDULED", publishAt, attempts: 0, nextAttemptAt: null, lastError: null, externalContainerId: null },
    });
    if (result.count === 0) return NextResponse.json({ error: "Esta publicação não pode ser reagendada." }, { status: 409 });
    await audit("rescheduled", { publishAt: publishAt.toISOString(), from: post.publishAt.toISOString() });
    if (post.contentItemId) await syncContentDate(post.contentItemId, session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "retry") {
    const result = await prisma.socialPost.updateMany({
      where: { id: post.id, status: "FAILED" },
      data: { status: "SCHEDULED", attempts: 0, nextAttemptAt: null, lastError: null, publishAt: new Date() },
    });
    if (result.count === 0) return NextResponse.json({ error: "Só dá para reenviar publicações que falharam." }, { status: 409 });
    await audit("retried");
    const outcome = await publishSocialPostNow(post.id, 50_000);
    return NextResponse.json({ ok: true, outcome });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
