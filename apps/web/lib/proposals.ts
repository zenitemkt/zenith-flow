import type { ProposalStatus } from "@zenith/db";

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
