import type { Lead, LeadStatus, PipelineStageKind, Prisma } from "@zenite-mkt/db";

const LEAD_FLOW: LeadStatus[] = ["NOVO", "EM_ANDAMENTO", "QUALIFICADO"];

export async function advanceLeadLifecycle(
  tx: Prisma.TransactionClient,
  lead: Lead,
  target: "EM_ANDAMENTO" | "QUALIFICADO",
  actorUserId: string | null,
  reason: string,
) {
  const targetIndex = LEAD_FLOW.indexOf(target);
  let currentIndex = LEAD_FLOW.indexOf(lead.status);
  if (lead.status === "CONVERTIDO" || currentIndex >= targetIndex) return lead;
  if (currentIndex < 0) currentIndex = 0;

  let previous: LeadStatus = lead.status;
  for (const status of LEAD_FLOW.slice(currentIndex + 1, targetIndex + 1)) {
    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, fromStatus: previous, toStatus: status, actorUserId, reason },
    });
    previous = status;
  }

  return tx.lead.update({
    where: { id: lead.id },
    data: { status: target, disqualifiedReason: null },
  });
}

export async function latestOpenOpportunity(tx: Prisma.TransactionClient, agencyId: string, leadId: string) {
  return tx.opportunity.findFirst({
    where: { agencyId, leadId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
}

export async function advanceOpportunityToStage(
  tx: Prisma.TransactionClient,
  opportunityId: string,
  agencyId: string,
  targetKind: PipelineStageKind,
  actorUserId: string | null,
  reason: string,
) {
  const opportunity = await tx.opportunity.findUnique({
    where: { id: opportunityId },
    include: { stage: true },
  });
  if (!opportunity || opportunity.agencyId !== agencyId || opportunity.status !== "OPEN") return opportunity;

  const target = await tx.pipelineStage.findFirst({ where: { agencyId, kind: targetKind } });
  if (!target || opportunity.stage.order >= target.order) return opportunity;

  const traversedStages = await tx.pipelineStage.findMany({
    where: { agencyId, order: { gt: opportunity.stage.order, lte: target.order } },
    orderBy: { order: "asc" },
  });
  let fromStageId = opportunity.stageId;
  for (const stage of traversedStages) {
    await tx.opportunityStatusHistory.create({
      data: {
        opportunityId: opportunity.id,
        fromStageId,
        toStageId: stage.id,
        toStatus: "OPEN",
        actorUserId,
        reason,
      },
    });
    fromStageId = stage.id;
  }

  return tx.opportunity.update({ where: { id: opportunity.id }, data: { stageId: target.id } });
}

export async function advanceLeadCommercialFlow(
  tx: Prisma.TransactionClient,
  input: {
    agencyId: string;
    leadId: string;
    targetStatus: "EM_ANDAMENTO" | "QUALIFICADO";
    targetStage: PipelineStageKind;
    actorUserId: string | null;
    reason: string;
    opportunityId?: string | null;
  },
) {
  const lead = await tx.lead.findUnique({ where: { id: input.leadId } });
  if (!lead || lead.agencyId !== input.agencyId) return null;
  const opportunity = input.opportunityId
    ? await tx.opportunity.findUnique({ where: { id: input.opportunityId } })
    : await latestOpenOpportunity(tx, input.agencyId, input.leadId);

  const updatedLead = await advanceLeadLifecycle(tx, lead, input.targetStatus, input.actorUserId, input.reason);
  if (opportunity) {
    await advanceOpportunityToStage(tx, opportunity.id, input.agencyId, input.targetStage, input.actorUserId, input.reason);
  }
  return { lead: updatedLead, opportunity };
}