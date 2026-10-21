import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";

interface RouteParams {
  params: { id: string };
}

const MAX_TARGET = 2_000_000_000;

async function authorize(id: string) {
  const session = await getServerSession();
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { error: NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 }) };
  if (!canManageTeam(membership.role)) {
    return { error: NextResponse.json({ error: "Apenas administradores podem alterar metas." }, { status: 403 }) };
  }
  const goal = await prisma.commercialGoal.findUnique({ where: { id } });
  if (!goal || goal.agencyId !== membership.agencyId) {
    return { error: NextResponse.json({ error: "Meta não encontrada." }, { status: 404 }) };
  }
  return { session, membership, goal };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await authorize(params.id);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const target = Number(body?.target);
  if (!Number.isInteger(target) || target <= 0 || target > MAX_TARGET) {
    return NextResponse.json({ error: "Informe um valor de meta maior que zero." }, { status: 400 });
  }
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : null;

  await prisma.commercialGoal.update({ where: { id: auth.goal.id }, data: { target, title } });
  await prisma.auditLog.create({
    data: {
      agencyId: auth.membership.agencyId,
      actorUserId: auth.session.user.id,
      actorType: "user",
      action: "commercial_goal.updated",
      resourceType: "commercial_goal",
      resourceId: auth.goal.id,
      metadata: { previousTarget: auth.goal.target, target },
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await authorize(params.id);
  if ("error" in auth) return auth.error;

  await prisma.commercialGoal.delete({ where: { id: auth.goal.id } });
  await prisma.auditLog.create({
    data: {
      agencyId: auth.membership.agencyId,
      actorUserId: auth.session.user.id,
      actorType: "user",
      action: "commercial_goal.deleted",
      resourceType: "commercial_goal",
      resourceId: auth.goal.id,
      metadata: { metric: auth.goal.metric, period: auth.goal.period, target: auth.goal.target },
    },
  });
  return NextResponse.json({ ok: true });
}
