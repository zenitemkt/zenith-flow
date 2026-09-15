import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { formatOpportunityValue, OPPORTUNITY_STATUS_BADGE_CLASS, OPPORTUNITY_STATUS_LABELS } from "@/lib/pipeline";
import { prisma } from "@zenith/db";
import { PipelineBoard } from "./PipelineBoard";
import { NewOpportunityModal } from "./NewOpportunityModal";
import { FunnelChart, type FunnelStage } from "@/app/_components/charts/FunnelChart";

export default async function PipelinePage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [stages, openOpportunities, closedOpportunities, wonCount, clients, leads] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { agencyId: membership.agencyId }, orderBy: { order: "asc" } }),
    prisma.opportunity.findMany({
      where: { agencyId: membership.agencyId, status: "OPEN" },
      include: { client: { select: { name: true } }, lead: { select: { name: true } } },
    }),
    prisma.opportunity.findMany({
      where: { agencyId: membership.agencyId, status: { in: ["WON", "LOST"] } },
      include: { client: { select: { name: true } }, lead: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.opportunity.count({ where: { agencyId: membership.agencyId, status: "WON" } }),
    prisma.client.findMany({ where: { agencyId: membership.agencyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: { agencyId: membership.agencyId, status: { not: "CONVERTIDO" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const funnelData: FunnelStage[] = [
    ...stages.map((stage) => ({
      label: stage.name,
      value: openOpportunities.filter((o) => o.stageId === stage.id).length,
    })),
    { label: "Ganhas", value: wonCount },
  ];
  const hasFunnelData = funnelData.some((stage) => stage.value > 0);

  const boardOpportunities = openOpportunities.map((o) => ({
    id: o.id,
    name: o.name,
    stageId: o.stageId,
    valueCents: o.valueCents,
    clientName: o.client?.name ?? null,
    leadName: o.lead?.name ?? null,
    expectedCloseDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString() : null,
  }));

  const wonTotal = openOpportunities.reduce((sum, o) => sum + (o.valueCents ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Pipeline comercial</h1>
          <p className="text-sm text-[#667085]">
            {openOpportunities.length} oportunidade{openOpportunities.length === 1 ? "" : "s"} aberta
            {openOpportunities.length === 1 ? "" : "s"} · {formatOpportunityValue(wonTotal)} em aberto (seção 39 do
            manual).
          </p>
        </div>
        <NewOpportunityModal clients={clients} leads={leads} />
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#101828]">Funil de oportunidades</h2>
        {hasFunnelData ? (
          <div className="mx-auto w-full max-w-md">
            <FunnelChart data={funnelData} orientation="vertical" color="#FF2B00" layers={3} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[#667085]">
            {stages.length === 0
              ? "Configure os estágios do pipeline e crie a primeira oportunidade para ver o funil."
              : "Nenhuma oportunidade ainda. Crie a primeira para ver o funil."}
          </p>
        )}
      </section>

      {stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum estágio de pipeline configurado.</p>
        </div>
      ) : (
        <PipelineBoard stages={stages} opportunities={boardOpportunities} />
      )}

      {closedOpportunities.length > 0 && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Ganhas e perdidas recentes</h2>
          <div className="flex flex-col gap-2">
            {closedOpportunities.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[#101828]">{o.name}</p>
                  <p className="text-xs text-[#98A2B3]">
                    {o.client?.name ?? o.lead?.name ?? "Sem vínculo"}
                    {o.status === "LOST" && o.lostReason ? ` · ${o.lostReason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#475467]">{formatOpportunityValue(o.valueCents)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OPPORTUNITY_STATUS_BADGE_CLASS[o.status]}`}>
                    {OPPORTUNITY_STATUS_LABELS[o.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
