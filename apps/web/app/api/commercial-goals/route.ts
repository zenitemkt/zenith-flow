import { NextResponse } from "next/server";
import { Prisma, prisma, type GoalMetric, type GoalPeriod } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { GOAL_METRIC_BY_ID, periodStartFor } from "@/lib/goal-periods";

const PERIODS: GoalPeriod[] = ["MONTHLY", "QUARTERLY"];
const MAX_TARGET = 2_000_000_000;

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem definir metas." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const metric = body?.metric as GoalMetric | undefined;
  const period = body?.period as GoalPeriod | undefined;
  const year = Number(body?.year);
  const month = Number(body?.month);
  const target = Number(body?.target);
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : null;

  if (!metric || !GOAL_METRIC_BY_ID[metric]) return NextResponse.json({ error: "Escolha o que a meta vai medir." }, { status: 400 });
  if (!period || !PERIODS.includes(period)) return NextResponse.json({ error: "Escolha mensal ou trimestral." }, { status: 400 });
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 0 || month > 11) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  if (!Number.isInteger(target) || target <= 0 || target > MAX_TARGET) {
    return NextResponse.json({ error: "Informe um valor de meta maior que zero." }, { status: 400 });
  }

  try {
    const goal = await prisma.$transaction(async (tx) => {
      const created = await tx.commercialGoal.create({
        data: {
          agencyId: membership.agencyId,
          metric,
          period,
          periodStart: periodStartFor(period, year, month),
          target,
          title,
          createdByUserId: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          agencyId: membership.agencyId,
          actorUserId: session.user.id,
          actorType: "user",
          action: "commercial_goal.created",
          resourceType: "commercial_goal",
          resourceId: created.id,
          metadata: { metric, period, target },
        },
      });
      return created;
    });
    return NextResponse.json({ id: goal.id }, { status: 201 });
  } catch (error) {
    // A combinação métrica + período é única: também cobre duplo clique/reenvio.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe uma meta dessa métrica para esse período. Edite a existente." },
        { status: 409 },
      );
    }
    throw error;
  }
}
