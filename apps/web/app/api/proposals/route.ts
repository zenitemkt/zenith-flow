import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { generateProposalToken } from "@/lib/proposals-server";
import { parseTimelineSteps } from "@/lib/proposals";
import { advanceLeadCommercialFlow, advanceOpportunityToStage, latestOpenOpportunity } from "@/lib/commercial-flow";
import { createInitialOpportunityForClient, createInitialOpportunityForLead } from "@/lib/lead-pipeline";
import { prisma, Prisma } from "@zenite-mkt/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  const content = optionalString(body?.content);
  const clientId = optionalString(body?.clientId);
  let linkedClientLeadId: string | null = null;
  let leadId = optionalString(body?.leadId);
  let opportunityId = optionalString(body?.opportunityId);
  const valueRaw = body?.value;
  const valueCents = valueRaw === null || valueRaw === undefined || valueRaw === "" ? null : Math.round(Number(valueRaw) * 100);
  const paymentTerms = optionalString(body?.paymentTerms);
  const timelineSteps = parseTimelineSteps(body?.timelineSteps);

  if (!name || !content) return NextResponse.json({ error: "Dê um nome e um conteúdo à proposta." }, { status: 400 });
  if (clientId && leadId) return NextResponse.json({ error: "Escolha um cliente ou um Lead, não os dois." }, { status: 400 });
  if (valueCents !== null && (!Number.isFinite(valueCents) || valueCents < 0)) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
    linkedClientLeadId = (await prisma.lead.findFirst({
      where: { agencyId: membership.agencyId, convertedClientId: clientId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }))?.id ?? null;
  }
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Lead inválido." }, { status: 400 });
    }
  }
  if (opportunityId) {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity || opportunity.agencyId !== membership.agencyId || opportunity.status !== "OPEN") {
      return NextResponse.json({ error: "Oportunidade inválida ou já encerrada." }, { status: 400 });
    }
    leadId = leadId ?? opportunity.leadId;
  }

  const proposal = await prisma.$transaction(async (tx) => {
    if (clientId && !leadId && !opportunityId) {
      const client = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
      const opportunity = await createInitialOpportunityForClient(tx, {
        agencyId: membership.agencyId,
        clientId,
        clientName: client.name,
        leadId: linkedClientLeadId,
        valueCents,
        actorUserId: session.user.id,
      });
      opportunityId = opportunity.id;
      leadId = linkedClientLeadId;
      await advanceOpportunityToStage(
        tx,
        opportunity.id,
        membership.agencyId,
        "PROPOSAL_RECEIVED",
        session.user.id,
        "Proposta criada para cliente",
      );
    }

    if (leadId && !opportunityId) {
      let opportunity = await latestOpenOpportunity(tx, membership.agencyId, leadId);
      if (!opportunity) {
        const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
        opportunity = await createInitialOpportunityForLead(tx, {
          agencyId: membership.agencyId,
          leadId,
          leadName: lead.name,
          actorUserId: session.user.id,
        });
      }
      opportunityId = opportunity.id;
    }

    if (leadId && opportunityId && !clientId) {
      await advanceLeadCommercialFlow(tx, {
        agencyId: membership.agencyId,
        leadId,
        opportunityId,
        targetStatus: "QUALIFICADO",
        targetStage: "PROPOSAL_RECEIVED",
        actorUserId: session.user.id,
        reason: "Proposta criada",
      });
      if (valueCents !== null) await tx.opportunity.update({ where: { id: opportunityId }, data: { valueCents } });
    }

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
    await tx.proposalStatusHistory.create({ data: { proposalId: created.id, toStatus: "RASCUNHO", actorUserId: session.user.id } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "proposal.created",
        resourceType: "proposal",
        resourceId: created.id,
        metadata: { leadId, clientId, opportunityId, valueCents },
      },
    });
    return created;
  });

  return NextResponse.json({ id: proposal.id }, { status: 201 });
}
