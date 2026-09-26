import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { advanceOpportunityToStage, latestOpenOpportunity } from "@/lib/commercial-flow";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead || lead.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }
  if (lead.status !== "QUALIFICADO") {
    return NextResponse.json({ error: "Só é possível tornar cliente um lead qualificado." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingClient = lead.convertedClientId
      ? await tx.client.findUnique({ where: { id: lead.convertedClientId } })
      : null;
    const client = existingClient ?? (await tx.client.create({
      data: { agencyId: membership.agencyId, name: lead.company || lead.name, email: lead.email, phone: lead.phone },
    }));

    if (!existingClient) {
      await tx.clientStatusHistory.create({
        data: { clientId: client.id, toStatus: "PROSPECT", actorUserId: session.user.id },
      });
      if (lead.email || lead.phone || lead.name) {
        await tx.clientContact.create({
          data: { clientId: client.id, name: lead.name, email: lead.email, phone: lead.phone, isPrimary: true },
        });
      }
    }

    const opportunity = await latestOpenOpportunity(tx, membership.agencyId, lead.id);
    let wonOpportunity = null;
    let proposal = null;
    if (opportunity) {
      await advanceOpportunityToStage(
        tx,
        opportunity.id,
        membership.agencyId,
        "PROPOSAL_RECEIVED",
        session.user.id,
        "Lead tornado cliente",
      );
      proposal = await tx.proposal.findFirst({
        where: { agencyId: membership.agencyId, OR: [{ opportunityId: opportunity.id }, { leadId: lead.id }] },
        orderBy: { createdAt: "desc" },
      });
      const valueCents = proposal?.valueCents ?? opportunity.valueCents;
      wonOpportunity = await tx.opportunity.update({
        where: { id: opportunity.id },
        data: { status: "WON", clientId: client.id, valueCents, lostReason: null },
      });
      await tx.opportunityStatusHistory.create({
        data: {
          opportunityId: opportunity.id,
          toStatus: "WON",
          actorUserId: session.user.id,
          reason: "Lead tornado cliente",
        },
      });
      await tx.auditLog.create({
        data: {
          agencyId: membership.agencyId,
          actorUserId: session.user.id,
          actorType: "user",
          action: "opportunity.won",
          resourceType: "opportunity",
          resourceId: opportunity.id,
          metadata: { valueCents, proposalId: proposal?.id ?? null },
        },
      });
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTIDO", convertedClientId: client.id },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, fromStatus: lead.status, toStatus: "CONVERTIDO", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "lead.converted",
        resourceType: "lead",
        resourceId: lead.id,
        metadata: { clientId: client.id, opportunityId: wonOpportunity?.id ?? null },
      },
    });
    return { client, opportunity: wonOpportunity, proposal };
  });

  if (result.opportunity) {
    await fireWorkflowTrigger(membership.agencyId, "opportunity.won", "opportunity", result.opportunity.id, {
      opportunityId: result.opportunity.id,
      name: result.opportunity.name,
      valueCents: result.opportunity.valueCents,
      leadId: result.opportunity.leadId,
      clientId: result.client.id,
    });
  }

  return NextResponse.json({ clientId: result.client.id }, { status: 201 });
}
