"use client";

import { useState } from "react";
import { Modal } from "@zenite-mkt/ui";
import { FunnelChart, type FunnelStage } from "@/app/_components/charts/FunnelChart";
import { formatOpportunityValue } from "@/lib/pipeline";

interface StageDetailOpportunity {
  id: string;
  name: string;
  clientName: string | null;
  leadName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  valueCents: number | null;
  expectedCloseDate: string | null;
  enteredStageAtISO: string;
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Um id de estágio real por posição em `funnelData`, na mesma ordem —
 * a última posição ("Ganhas") usa o sentinela "WON", que não é um
 * `PipelineStage` de verdade (ver `/api/pipeline/stage-detail`).
 */
export function PipelineFunnelSection({
  funnelData,
  stageIds,
  periodQuery,
}: {
  funnelData: FunnelStage[];
  stageIds: string[];
  periodQuery: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<StageDetailOpportunity[]>([]);

  async function openStage(index: number) {
    const stageId = stageIds[index];
    if (!stageId) return;
    setOpenIndex(index);
    setLoading(true);
    setError(null);
    setOpportunities([]);
    const query = new URLSearchParams(periodQuery);
    query.set("stageId", stageId);
    const response = await fetch(`/api/pipeline/stage-detail?${query.toString()}`);
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível carregar as oportunidades.");
      return;
    }
    setOpportunities(body.opportunities ?? []);
  }

  const isWonSegment = openIndex !== null && stageIds[openIndex] === "WON";
  const stageLabel = openIndex !== null ? (funnelData[openIndex]?.label ?? "") : "";

  return (
    <>
      <div className="mx-auto w-full max-w-md">
        <FunnelChart data={funnelData} orientation="vertical" color="#FF2B00" layers={3} onStageClick={openStage} />
      </div>
      <Modal
        open={openIndex !== null}
        onClose={() => setOpenIndex(null)}
        title={stageLabel}
        description={isWonSegment ? "Oportunidades ganhas no período." : "Oportunidades atualmente nesta etapa."}
        size="lg"
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-[#667085]">Carregando...</p>
        ) : error ? (
          <p className="text-sm font-medium text-[#D94343]">{error}</p>
        ) : opportunities.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#667085]">Nenhuma oportunidade encontrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {opportunities.map((opp) => {
              const days = daysSince(opp.enteredStageAtISO);
              return (
                <div key={opp.id} className="rounded-lg border border-[#E4E7EC] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[#101828]">{opp.name}</p>
                    <span className="shrink-0 text-sm font-semibold text-[#166534]">
                      {formatOpportunityValue(opp.valueCents)}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085]">{opp.clientName ?? opp.leadName ?? "Sem vínculo"}</p>
                  {(opp.contactEmail || opp.contactPhone) && (
                    <p className="text-xs text-[#98A2B3]">
                      {[opp.contactEmail, opp.contactPhone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[#98A2B3]">
                    <span>
                      {days} dia{days === 1 ? "" : "s"} nesta etapa
                    </span>
                    {opp.expectedCloseDate && (
                      <span>Fechamento previsto: {new Date(opp.expectedCloseDate).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
