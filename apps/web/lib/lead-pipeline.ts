import type { Prisma } from "@prisma/client";

interface InitialOpportunityInput {
  agencyId: string;
  leadId: string;
  leadName: string;
  actorUserId?: string | null;
}

export async function createInitialOpportunityForLead(
  tx: Prisma.TransactionClient,
  input: InitialOpportunityInput,
) {
  let firstStage = await tx.pipelineStage.findFirst({
    where: { agencyId: input.agencyId },
    orderBy: { order: "asc" },
  });

  if (!firstStage) {
    firstStage = await tx.pipelineStage.create({
      data: { agencyId: input.agencyId, name: "Novo contato", order: 0 },
    });
  }

  const opportunity = await tx.opportunity.create({
    data: {
      agencyId: input.agencyId,
      leadId: input.leadId,
      name: input.leadName,
      stageId: firstStage.id,
      createdByUserId: input.actorUserId ?? null,
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
      metadata: { leadId: input.leadId, automatic: true },
    },
  });

  return opportunity;
}