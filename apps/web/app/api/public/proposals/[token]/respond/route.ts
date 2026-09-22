import { NextResponse } from "next/server";
import { isProposalExpired } from "@/lib/proposals";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { token: string };
}

/** Público, sem sessão — mesma família de /api/approvals/[token] e /api/public/survey/[token]/respond. */
export async function POST(request: Request, { params }: RouteParams) {
  const proposal = await prisma.proposal.findUnique({ where: { token: params.token } });

  if (!proposal || proposal.status === "RASCUNHO") {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }
  if (isProposalExpired(proposal)) {
    return NextResponse.json({ error: "Esta proposta expirou." }, { status: 400 });
  }
  if (proposal.status === "ACEITA" || proposal.status === "REJEITADA" || proposal.status === "EXPIRADA") {
    return NextResponse.json({ error: "Esta proposta já foi respondida." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const decision = body?.decision as "ACEITA" | "REJEITADA" | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (decision !== "ACEITA" && decision !== "REJEITADA") {
    return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });
  }
  if (decision === "REJEITADA" && !reason) {
    return NextResponse.json({ error: "Conte pra gente o motivo da recusa." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        status: decision,
        respondedAt: new Date(),
        rejectedReason: decision === "REJEITADA" ? reason : null,
      },
    });
    await tx.proposalStatusHistory.create({
      data: { proposalId: proposal.id, fromStatus: proposal.status, toStatus: decision, reason },
    });

    // Aceite avança a Oportunidade vinculada pra próxima etapa do Pipeline
    // da agência — só faz sentido enquanto ela ainda está aberta.
    if (decision === "ACEITA" && proposal.opportunityId) {
      const opportunity = await tx.opportunity.findUnique({ where: { id: proposal.opportunityId } });
      if (opportunity && opportunity.status === "OPEN") {
        const currentStage = await tx.pipelineStage.findUnique({ where: { id: opportunity.stageId } });
        if (currentStage) {
          const nextStage = await tx.pipelineStage.findFirst({
            where: { agencyId: currentStage.agencyId, order: { gt: currentStage.order } },
            orderBy: { order: "asc" },
          });
          if (nextStage) {
            await tx.opportunity.update({ where: { id: opportunity.id }, data: { stageId: nextStage.id } });
            await tx.opportunityStatusHistory.create({
              data: {
                opportunityId: opportunity.id,
                fromStageId: opportunity.stageId,
                toStageId: nextStage.id,
                toStatus: "OPEN",
                reason: "Proposta aceita",
              },
            });
          }
        }
      }
    }
  });

  return NextResponse.json({ ok: true, status: decision });
}
