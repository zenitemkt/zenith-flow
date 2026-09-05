/**
 * Seção 32.1: eNPS usa a mesma matemática do NPS (% promotores - %
 * detratores) — reaproveitada de `lib/nps.ts` (`computeNpsBreakdown`,
 * `npsClassification`) em vez de duplicada aqui. O que muda de verdade é o
 * público (funcionários, não clientes) e a garantia de anonimato — ver
 * `EnpsResponse` em `packages/db/prisma/schema.prisma`.
 */
export { computeNpsBreakdown as computeEnpsBreakdown, npsClassification } from "./nps";

export const DEFAULT_ENPS_QUESTION =
  "De 0 a 10, o quanto você recomendaria esta agência como um bom lugar para trabalhar?";
export const DEFAULT_ENPS_COMMENT_PROMPT = "O que motivou sua nota?";

export type EnpsCampaignStatus = "RASCUNHO" | "ENVIADA" | "ENCERRADA";

export const ENPS_STATUS_LABELS: Record<EnpsCampaignStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  ENCERRADA: "Encerrada",
};

export const ENPS_STATUS_BADGE_CLASS: Record<EnpsCampaignStatus, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ENVIADA: "bg-[#EEF2FF] text-[#3730A3]",
  ENCERRADA: "bg-[#DCFCE7] text-[#166534]",
};
