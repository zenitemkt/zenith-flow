import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { generateProposalToken } from "@/lib/proposals-server";
import { parseTimelineSteps } from "@/lib/proposals";
import { prisma, Prisma } from "@zenite-mkt/db";

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
  const content = optionalString(body?.content);
  const clientId = optionalString(body?.clientId);
  const leadId = optionalString(body?.leadId);
  const opportunityId = optionalString(body?.opportunityId);
  const valueRaw = body?.value;
  const valueCents =
    valueRaw === null || valueRaw === undefined || valueRaw === "" ? null : Math.round(Number(valueRaw) * 100);
  const paymentTerms = optionalString(body?.paymentTerms);
  const timelineSteps = parseTimelineSteps(body?.timelineSteps);

  if (!name || !content) {
    return NextResponse.json({ error: "Dê um nome e um conteúdo à proposta." }, { status: 400 });
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
  if (opportunityId) {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity || opportunity.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Oportunidade inválida." }, { status: 400 });
    }
  }

  const proposal = await prisma.$transaction(async (tx) => {
    const created = await tx.proposal.create({
      data: {
        agencyId: membership.agencyId,
        name,
        content,
        clientId,
        leadId,
        opportunityId,
        valueCents,
        paymentTerms,
        timelineSteps: (timelineSteps as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        token: generateProposalToken(),
        createdByUserId: session.user.id,
      },
    });
    await tx.proposalStatusHistory.create({
      data: { proposalId: created.id, toStatus: "RASCUNHO", actorUserId: session.user.id },
    });
    return created;
  });

  return NextResponse.json({ id: proposal.id }, { status: 201 });
}
