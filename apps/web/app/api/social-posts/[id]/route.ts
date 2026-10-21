import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { publishSocialPostNow } from "@/lib/social-publisher";

export const maxDuration = 60;

interface RouteParams {
  params: { id: string };
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
  if (!post || post.agencyId !== membership.agencyId) {
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
      data: { status: "SCHEDULED", publishAt, attempts: 0, nextAttemptAt: null, lastError: null },
    });
    if (result.count === 0) return NextResponse.json({ error: "Esta publicação não pode ser reagendada." }, { status: 409 });
    await audit("rescheduled", { publishAt: publishAt.toISOString() });
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
