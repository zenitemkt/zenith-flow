import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { requireSessionAndMembership } from "@/lib/session";
import { formatOpportunityValue, OPPORTUNITY_STATUS_BADGE_CLASS, OPPORTUNITY_STATUS_LABELS } from "@/lib/pipeline";
import { resolvePipelinePeriod } from "@/lib/pipeline-period";
import { prisma } from "@zenite-mkt/db";
import { PipelineBoard } from "./PipelineBoard";
import { PipelinePeriodFilter } from "./PipelinePeriodFilter";
import { NewOpportunityModal } from "./NewOpportunityModal";
import type { FunnelStage } from "@/app/_components/charts/FunnelChart";

const FunnelChart = dynamic(() =>
  import("@/app/_components/charts/FunnelChart").then((module) => module.FunnelChart),
);

interface PageProps {
  searchParams: { period?: string; year?: string; month?: string; from?: string; to?: string };
}

export default async function PipelinePage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  const selectedPeriod = resolvePipelinePeriod(searchParams);
  const periodWhere = selectedPeriod.createdAt ? { createdAt: selectedPeriod.createdAt } : {};
  const [stages, openOpportunities, periodOpportunities, closedOpportunities, clients, leads] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { agencyId: membership.agencyId }, orderBy: { order: "asc" } }),
    prisma.opportunity.findMany({
      where: { agencyId: membership.agencyId, status: "OPEN" },
      include: { client: { select: { name: true } }, lead: { select: { name: true } } },
    }),
    prisma.opportunity.findMany({
      where: { agencyId: membership.agencyId, ...periodWhere },
      select: { stageId: true, status: true, valueCents: true },
    }),
    prisma.opportunity.findMany({
      where: { agencyId: membership.agencyId, status: { in: ["WON", "LOST"] }, ...periodWhere },
      include: { client: { select: { name: true } }, lead: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.client.findMany({ where: { agencyId: membership.agencyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: { agencyId: membership.agencyId, status: { not: "CONVERTIDO" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const wonOpportunities = periodOpportunities.filter((opportunity) => opportunity.status === "WON");
  const wonValueCents = wonOpportunities.reduce((sum, opportunity) => sum + (opportunity.valueCents ?? 0), 0);
  const conversionRate = periodOpportunities.length > 0 ? (wonOpportunities.length / periodOpportunities.length) * 100 : 0;
  const stageOrderById = new Map(stages.map((stage) => [stage.id, stage.order]));
  const funnelData: FunnelStage[] = [
    ...stages.map((stage) => ({
      label: stage.name,
      // O funil é cumulativo: quem chegou a "Em andamento" também passou por
      // "Novo contato"; quem ganhou percorreu todas as etapas anteriores.
      value: periodOpportunities.filter((opportunity) => {
        if (opportunity.status === "WON") return true;
        const currentOrder = stageOrderById.get(opportunity.stageId);
        return currentOrder !== undefined && currentOrder >= stage.order;
      }).length,
    })),
    { label: "Ganhas", value: wonOpportunities.length },
  ];
  const hasFunnelData = funnelData.some((stage) => stage.value > 0);
  const boardOpportunities = openOpportunities.map((opportunity) => ({
    id: opportunity.id,
    name: opportunity.name,
    stageId: opportunity.stageId,
    valueCents: opportunity.valueCents,
    clientName: opportunity.client?.name ?? null,
    leadName: opportunity.lead?.name ?? null,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
  }));
  const openValueCents = openOpportunities.reduce((sum, opportunity) => sum + (opportunity.valueCents ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Pipeline comercial</h1>
          <p className="text-sm text-[#667085]">
            {openOpportunities.length} oportunidade{openOpportunities.length === 1 ? "" : "s"} aberta{openOpportunities.length === 1 ? "" : "s"} · {formatOpportunityValue(openValueCents)} em aberto.
          </p>
        </div>
        <NewOpportunityModal clients={clients} leads={leads} />
      </div>

      <PipelinePeriodFilter
        initialPeriod={selectedPeriod.period}
        initialYear={searchParams.year}
        initialMonth={searchParams.month}
        initialFrom={searchParams.from}
        initialTo={searchParams.to}
      />

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#101828]">Indicadores do funil</h2>
            <p className="text-xs text-[#667085]">Oportunidades criadas em {selectedPeriod.label.toLocaleLowerCase()}.</p>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-[#EEF0F3] p-3"><p className="text-xl font-semibold text-[#101828]">{periodOpportunities.length}</p><p className="text-xs text-[#667085]">oportunidades</p></div>
          <div className="rounded-lg border border-[#EEF0F3] p-3"><p className="text-xl font-semibold text-[#16A36A]">{wonOpportunities.length}</p><p className="text-xs text-[#667085]">ganhas</p></div>
          <div className="rounded-lg border border-[#EEF0F3] p-3"><p className="text-xl font-semibold text-[#101828]">{formatOpportunityValue(wonValueCents)}</p><p className="text-xs text-[#667085]">valor ganho</p></div>
          <div className="rounded-lg border border-[#EEF0F3] p-3"><p className="text-xl font-semibold text-[#101828]">{conversionRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p><p className="text-xs text-[#667085]">taxa de conversão</p></div>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-[#101828]">Funil de oportunidades</h3>
        {hasFunnelData ? (
          <div className="mx-auto w-full max-w-md"><FunnelChart data={funnelData} orientation="vertical" color="#FF2B00" layers={3} /></div>
        ) : (
          <p className="py-6 text-center text-sm text-[#667085]">Nenhuma oportunidade encontrada neste período.</p>
        )}
      </section>

      {stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center"><p className="text-sm text-[#667085]">Nenhum estágio de pipeline configurado.</p></div>
      ) : (
        <PipelineBoard stages={stages} opportunities={boardOpportunities} />
      )}

      {closedOpportunities.length > 0 && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Ganhas e perdidas no período</h2>
          <div className="flex flex-col gap-2">
            {closedOpportunities.map((opportunity) => (
              <div key={opportunity.id} className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[#101828]">{opportunity.name}</p>
                  <p className="text-xs text-[#98A2B3]">{opportunity.client?.name ?? opportunity.lead?.name ?? "Sem vínculo"}{opportunity.status === "LOST" && opportunity.lostReason ? ` · ${opportunity.lostReason}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#475467]">{formatOpportunityValue(opportunity.valueCents)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OPPORTUNITY_STATUS_BADGE_CLASS[opportunity.status]}`}>{OPPORTUNITY_STATUS_LABELS[opportunity.status]}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
