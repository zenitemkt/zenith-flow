/**
 * Seção 32.1 do manual: "pesquisas possuem campanha, pergunta 0-10,
 * comentário, público, janela, anonimato e consentimento." NPS = %
 * promotores - % detratores. Classificação padrão do mercado: 9-10
 * promotor, 7-8 neutro, 0-6 detrator — o manual não redefine esses cortes.
 */
export const DEFAULT_NPS_QUESTION =
  "De 0 a 10, o quanto você recomendaria nossa agência para um amigo ou colega?";
export const DEFAULT_NPS_COMMENT_PROMPT = "O que motivou sua nota?";

export type SurveyStatus = "RASCUNHO" | "ENVIADA" | "ENCERRADA";

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  ENCERRADA: "Encerrada",
};

export const SURVEY_STATUS_BADGE_CLASS: Record<SurveyStatus, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ENVIADA: "bg-[#EEF2FF] text-[#3730A3]",
  ENCERRADA: "bg-[#DCFCE7] text-[#166534]",
};

export function npsClassification(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

export interface NpsBreakdown {
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  totalResponses: number;
}

export function computeNpsBreakdown(scores: number[]): NpsBreakdown {
  const promoters = scores.filter((s) => npsClassification(s) === "promoter").length;
  const passives = scores.filter((s) => npsClassification(s) === "passive").length;
  const detractors = scores.filter((s) => npsClassification(s) === "detractor").length;
  const total = scores.length;
  const score = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
  return { score, promoters, passives, detractors, totalResponses: total };
}
