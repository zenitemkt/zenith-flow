import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type OpportunityStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

const VALID_STATUSES: OpportunityStatus[] = ["WON", "LOST"];

/** Ganho/Perdido — terminal, seção 39: "open -> won/lost." Sem caminho de volta nesta fatia. */
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

  const opportunity = await prisma.opportunity.findUnique({ where: { id: params.id } });
  if (!opportunity || opportunity.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Oportunidade não encontrada." }, { status: 404 });
  }
  if (opportunity.status !== "OPEN") {
    return NextResponse.json({ error: "Esta oportunidade já foi encerrada." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as OpportunityStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!toStatus || !VALID_STATUSES.includes(toStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (toStatus === "LOST" && !reason) {
    return NextResponse.json({ error: "Informe o motivo da perda." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id: opportunity.id },
      data: { status: toStatus, lostReason: toStatus === "LOST" ? reason : null },
    });
    await tx.opportunityStatusHistory.create({
      data: { opportunityId: opportunity.id, toStatus, reason, actorUserId: session.user.id },
    });
    if (toStatus === "WON") {
      await tx.auditLog.create({
        data: {
          agencyId: membership.agencyId,
          actorUserId: session.user.id,
          actorType: "user",
          action: "opportunity.won",
          resourceType: "opportunity",
          resourceId: opportunity.id,
          metadata: { valueCents: opportunity.valueCents },
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
