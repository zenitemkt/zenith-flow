import type { Prisma } from "@prisma/client";
import { DEFAULT_PIPELINE_STAGES } from "./pipeline";

interface BaseOpportunityInput {
  agencyId: string;
  name: string;
  actorUserId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  submissionId?: string | null;
  valueCents?: number | null;
}

async function firstPipelineStage(tx: Prisma.TransactionClient, agencyId: string) {
  let firstStage = await tx.pipelineStage.findFirst({ where: { agencyId, kind: "NEW_CONTACT" } });
  if (firstStage) return firstStage;

  const anyStage = await tx.pipelineStage.findFirst({ where: { agencyId }, orderBy: { order: "asc" } });
  if (anyStage) return anyStage;

  await tx.pipelineStage.createMany({
    data: DEFAULT_PIPELINE_STAGES.map((stage, order) => ({ agencyId, ...stage, order })),
  });
  firstStage = await tx.pipelineStage.findFirst({ where: { agencyId, kind: "NEW_CONTACT" } });
  if (!firstStage) throw new Error("Não foi possível configurar o primeiro estágio da pipeline.");
  return firstStage;
}

async function createInitialOpportunity(tx: Prisma.TransactionClient, input: BaseOpportunityInput) {
  const firstStage = await firstPipelineStage(tx, input.agencyId);
  const opportunity = await tx.opportunity.create({
    data: {
      agencyId: input.agencyId,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      name: input.name,
      valueCents: input.valueCents ?? null,
      stageId: firstStage.id,
      createdByUserId: input.actorUserId ?? null,
      submissionId: input.submissionId ?? null,
    },
  });

  await tx.opportunityStatusHistory.create({
    data: {
      opportunityId: opportunity.id,
      toStageId: firstStage.id,
      toStatus: "OPEN",
      actorUserId: input.actorUserId ?? null,
    },
  });
  await tx.auditLog.create({
    data: {
      agencyId: input.agencyId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorUserId ? "user" : "integration",
      action: "opportunity.created",
      resourceType: "opportunity",
      resourceId: opportunity.id,
      metadata: {
        leadId: input.leadId ?? null,
        clientId: input.clientId ?? null,
        submissionId: input.submissionId ?? null,
        automatic: true,
      },
    },
  });
  return opportunity;
}

interface InitialLeadOpportunityInput {
  agencyId: string;
  leadId: string;
  leadName: string;
  actorUserId?: string | null;
  submissionId?: string | null;
}

export function createInitialOpportunityForLead(tx: Prisma.TransactionClient, input: InitialLeadOpportunityInput) {
  return createInitialOpportunity(tx, {
    agencyId: input.agencyId,
    leadId: input.leadId,
    name: input.leadName,
    actorUserId: input.actorUserId,
    submissionId: input.submissionId,
  });
}

interface InitialClientOpportunityInput {
  agencyId: string;
  clientId: string;
  clientName: string;
  leadId?: string | null;
  valueCents?: number | null;
  actorUserId?: string | null;
}

export function createInitialOpportunityForClient(tx: Prisma.TransactionClient, input: InitialClientOpportunityInput) {
  return createInitialOpportunity(tx, {
    agencyId: input.agencyId,
    clientId: input.clientId,
    leadId: input.leadId,
    name: input.clientName,
    valueCents: input.valueCents,
    actorUserId: input.actorUserId,
  });
}
