import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

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
  const name = optionalString(body?.name);
  const clientId = optionalString(body?.clientId);
  const leadId = optionalString(body?.leadId);
  const valueRaw = body?.value;
  const valueCents =
    valueRaw === null || valueRaw === undefined || valueRaw === "" ? null : Math.round(Number(valueRaw) * 100);
  const expectedCloseDateRaw = optionalString(body?.expectedCloseDate);
  const expectedCloseDate = expectedCloseDateRaw ? new Date(expectedCloseDateRaw) : null;

  if (!name) {
    return NextResponse.json({ error: "Dê um nome à oportunidade." }, { status: 400 });
  }
  if (valueCents !== null && (!Number.isFinite(valueCents) || valueCents < 0)) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
  }
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Lead inválido." }, { status: 400 });
    }
  }

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { agencyId: membership.agencyId },
    orderBy: { order: "asc" },
  });
  if (!firstStage) {
    return NextResponse.json({ error: "Nenhum estágio de pipeline configurado." }, { status: 400 });
  }

  const opportunity = await prisma.$transaction(async (tx) => {
    const created = await tx.opportunity.create({
      data: {
        agencyId: membership.agencyId,
        name,
        clientId,
        leadId,
        valueCents,
        stageId: firstStage.id,
        expectedCloseDate,
        createdByUserId: session.user.id,
      },
    });
    await tx.opportunityStatusHistory.create({
      data: { opportunityId: created.id, toStageId: firstStage.id, toStatus: "OPEN", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "opportunity.created",
        resourceType: "opportunity",
        resourceId: created.id,
      },
    });
    return created;
  });

  return NextResponse.json({ id: opportunity.id }, { status: 201 });
}
