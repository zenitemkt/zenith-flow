import type { OpportunityStatus } from "@zenite-mkt/db";

/** Seção 39: "custom pipeline" — 4 estágios padrão semeados no signup, mesmo padrão do onboarding de clientes. Agência edita livremente depois. */
export const DEFAULT_PIPELINE_STAGE_NAMES = ["Novo contato", "Qualificação", "Proposta enviada", "Negociação"];

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
