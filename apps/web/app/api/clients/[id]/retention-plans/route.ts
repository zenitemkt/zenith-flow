import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Playbook de retenção (seção 31.1): "toda recomendação precisa de
 * responsável, prazo, próxima revisão e resultado". Criar um plano não some
 * ao score de churn — é a ação humana em resposta a ele.
 */
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

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const alertReason = optionalString(body?.alertReason);
  const diagnosis = optionalString(body?.diagnosis);
  const responsibleUserId = optionalString(body?.responsibleUserId);
  const planDescription = optionalString(body?.planDescription);
  const meetingDateRaw = optionalString(body?.meetingDate);
  const reassessDateRaw = optionalString(body?.reassessDate);

  if (!alertReason || !diagnosis || !responsibleUserId || !planDescription) {
    return NextResponse.json(
      { error: "Motivo do alerta, diagnóstico, responsável e plano de ação são obrigatórios." },
      { status: 400 },
    );
  }

  const responsibleMembership = await prisma.membership.findFirst({
    where: { userId: responsibleUserId, agencyId: membership.agencyId, status: "ACTIVE" },
  });
  if (!responsibleMembership) {
    return NextResponse.json({ error: "Responsável inválido." }, { status: 400 });
  }

  const meetingDate = meetingDateRaw ? new Date(meetingDateRaw) : null;
  const reassessDate = reassessDateRaw ? new Date(reassessDateRaw) : null;
  if ((meetingDate && isNaN(meetingDate.getTime())) || (reassessDate && isNaN(reassessDate.getTime()))) {
    return NextResponse.json({ error: "Datas inválidas." }, { status: 400 });
  }

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.retentionPlan.create({
      data: {
        agencyId: membership.agencyId,
        clientId: client.id,
        alertReason,
        diagnosis,
        responsibleUserId,
        planDescription,
        meetingDate,
        reassessDate,
        createdByUserId: session.user.id,
      },
    });
    await tx.retentionPlanStatusHistory.create({
      data: { planId: created.id, toStatus: "ATIVO", actorUserId: session.user.id },
    });
    return created;
  });

  return NextResponse.json({ id: plan.id }, { status: 201 });
}
