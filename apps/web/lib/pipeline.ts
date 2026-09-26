import type { OpportunityStatus, PipelineStageKind } from "@zenite-mkt/db";

/** Etapas semânticas do fluxo comercial; o nome visível pode mudar sem quebrar automações. */
export const DEFAULT_PIPELINE_STAGES: { name: string; kind: PipelineStageKind }[] = [
  { name: "Novo contato", kind: "NEW_CONTACT" },
  { name: "Em andamento", kind: "IN_PROGRESS" },
  { name: "Qualificado", kind: "QUALIFIED" },
  { name: "Recebeu proposta", kind: "PROPOSAL_RECEIVED" },
];

export const DEFAULT_PIPELINE_STAGE_NAMES = DEFAULT_PIPELINE_STAGES.map((stage) => stage.name);

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  OPEN: "Aberta",
  WON: "Ganha",
  LOST: "Perdida",
};

export const OPPORTUNITY_STATUS_BADGE_CLASS: Record<OpportunityStatus, string> = {
  OPEN: "bg-[#EEF2FF] text-[#3730A3]",
  WON: "bg-[#DCFCE7] text-[#166534]",
  LOST: "bg-[#FEE4E2] text-[#B42318]",
};

export function formatOpportunityValue(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}