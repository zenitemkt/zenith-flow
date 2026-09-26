import type { Prisma } from "@prisma/client";
import { DEFAULT_PIPELINE_STAGES } from "./pipeline";

interface InitialOpportunityInput {
  agencyId: string;
  leadId: string;
  leadName: string;
  actorUserId?: string | null;
  submissionId?: string | null;
}

export async function createInitialOpportunityForLead(tx: Prisma.TransactionClient, input: InitialOpportunityInput) {
  let firstStage = await tx.pipelineStage.findFirst({
    where: { agencyId: input.agencyId, kind: "NEW_CONTACT" },
  });

  if (!firstStage) {
    const anyStage = await tx.pipelineStage.findFirst({ where: { agencyId: input.agencyId } });
    if (!anyStage) {
      await tx.pipelineStage.createMany({
        data: DEFAULT_PIPELINE_STAGES.map((stage, order) => ({ agencyId: input.agencyId, ...stage, order })),
      });
      firstStage = await tx.pipelineStage.findFirst({
        where: { agencyId: input.agencyId, kind: "NEW_CONTACT" },
      });
    } else {
      firstStage = await tx.pipelineStage.findFirst({
        where: { agencyId: input.agencyId },
        orderBy: { order: "asc" },
      });
    }
  }

  if (!firstStage) throw new Error("Não foi possível configurar o primeiro estágio da pipeline.");

  const opportunity = await tx.opportunity.create({
    data: {
      agencyId: input.agencyId,
      leadId: input.leadId,
      name: input.leadName,
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
      metadata: { leadId: input.leadId, submissionId: input.submissionId ?? null, automatic: true },
    },
  });

  return opportunity;
}
