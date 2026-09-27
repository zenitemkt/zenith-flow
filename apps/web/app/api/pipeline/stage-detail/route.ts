import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { resolvePipelinePeriod } from "@/lib/pipeline-period";
import { prisma } from "@zenite-mkt/db";

/**
 * Detalhe de uma etapa do funil (Pipeline comercial), aberto ao clicar numa
 * barra do gráfico. `stageId=WON` é um sentinela pro segmento "Ganhas" do
 * gráfico, que não é um `PipelineStage` de verdade — filtra por
 * `status: "WON"` em vez de estágio.
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const stageId = searchParams.get("stageId");
  if (!stageId) {
    return NextResponse.json({ error: "Estágio não informado." }, { status: 400 });
  }

  const period = resolvePipelinePeriod({
    period: searchParams.get("period") ?? undefined,
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  const periodWhere = period.createdAt ? { createdAt: period.createdAt } : {};

  const isWonSegment = stageId === "WON";
  if (!isWonSegment) {
    const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
    if (!stage || stage.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Estágio não encontrado." }, { status: 404 });
    }
  }

  const opportunities = await prisma.opportunity.findMany({
    where: {
      agencyId: membership.agencyId,
      ...periodWhere,
      ...(isWonSegment ? { status: "WON" } : { stageId, status: "OPEN" }),
    },
    include: {
      client: { select: { name: true, contacts: { select: { name: true, email: true, phone: true, isPrimary: true }, orderBy: { isPrimary: "desc" } } } },
      lead: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const opportunityIds = opportunities.map((o) => o.id);
  const lastStageEntries = opportunityIds.length
    ? await prisma.opportunityStatusHistory.findMany({
        where: { opportunityId: { in: opportunityIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const enteredStageAtByOpportunity = new Map<string, Date>();
  for (const entry of lastStageEntries) {
    if (enteredStageAtByOpportunity.has(entry.opportunityId)) continue;
    if (isWonSegment || entry.toStageId === stageId) {
      enteredStageAtByOpportunity.set(entry.opportunityId, entry.createdAt);
    }
  }

  const result = opportunities.map((opportunity) => {
    const primaryContact = opportunity.client?.contacts.find((c) => c.isPrimary) ?? opportunity.client?.contacts.find((c) => c.email) ?? null;
    const contactEmail = primaryContact?.email ?? opportunity.lead?.email ?? null;
    const contactPhone = primaryContact?.phone ?? opportunity.lead?.phone ?? null;
    const enteredStageAt = enteredStageAtByOpportunity.get(opportunity.id) ?? opportunity.createdAt;

    return {
      id: opportunity.id,
      name: opportunity.name,
      clientName: opportunity.client?.name ?? null,
      leadName: opportunity.lead?.name ?? null,
      contactEmail,
      contactPhone,
      valueCents: opportunity.valueCents,
      expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
      enteredStageAtISO: enteredStageAt.toISOString(),
    };
  });

  return NextResponse.json({ opportunities: result });
}
