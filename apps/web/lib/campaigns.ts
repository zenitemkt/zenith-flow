import type { CampaignStatus } from "@zenith/db";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  ATIVA: "Ativa",
  PAUSADA: "Pausada",
  ENCERRADA: "Encerrada",
};

export const CAMPAIGN_STATUS_BADGE_CLASS: Record<CampaignStatus, string> = {
  ATIVA: "bg-[#DCFCE7] text-[#166534]",
  PAUSADA: "bg-[#FEF3C7] text-[#92600A]",
  ENCERRADA: "bg-[#F2F4F7] text-[#475467]",
};

export const CAMPAIGN_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  ATIVA: ["PAUSADA", "ENCERRADA"],
  PAUSADA: ["ATIVA", "ENCERRADA"],
  ENCERRADA: [],
};

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
