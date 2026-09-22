import type { ProposalStatus } from "@zenite-mkt/db";

/** Seção 39: "Proposal: draft -> sent -> viewed -> accepted/rejected/expired." */
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISUALIZADA: "Visualizada",
  ACEITA: "Aceita",
  REJEITADA: "Rejeitada",
  EXPIRADA: "Expirada",
};

export const PROPOSAL_STATUS_BADGE_CLASS: Record<ProposalStatus, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ENVIADA: "bg-[#EEF2FF] text-[#3730A3]",
  VISUALIZADA: "bg-[#FEF3C7] text-[#92600A]",
  ACEITA: "bg-[#DCFCE7] text-[#166534]",
  REJEITADA: "bg-[#FEE4E2] text-[#B42318]",
  EXPIRADA: "bg-[#F2F4F7] text-[#98A2B3]",
};

/** Mesmo TTL de ContentApproval (seção 17) — 14 dias. */
export const PROPOSAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Expiração é computada ao vivo (mesmo padrão de ContentApproval em /aprovar/[token]) — nunca depende de um job pra "estar certa" na tela. */
export function isProposalExpired(proposal: { status: ProposalStatus; expiresAt: Date | null }): boolean {
  if (proposal.status !== "ENVIADA" && proposal.status !== "VISUALIZADA") return false;
  return proposal.expiresAt !== null && proposal.expiresAt < new Date();
}

export function formatProposalValue(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface TimelineStep {
  label: string;
  days: number;
}

/** Valida o formato bruto vindo do body da requisição antes de gravar em `timelineSteps` (Json). */
export function parseTimelineSteps(value: unknown): TimelineStep[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const steps: TimelineStep[] = [];
  for (const item of value) {
    const label = typeof item?.label === "string" ? item.label.trim() : "";
    const days = Number(item?.days);
    if (!label || !Number.isFinite(days) || days < 0) continue;
    steps.push({ label, days: Math.round(days) });
  }
  return steps.length > 0 ? steps : null;
}

/** CC/CCO aceitam múltiplos endereços separados por vírgula (seção do popup de envio). */
export function splitEmailList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.includes("@"));
}
