import type { JobStatus, CandidateStatus } from "@zenite-mkt/db";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  ABERTA: "Aberta",
  PAUSADA: "Pausada",
  FECHADA: "Fechada",
  CANCELADA: "Cancelada",
};

export const JOB_STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  ABERTA: "bg-[#DCFCE7] text-[#166534]",
  PAUSADA: "bg-[#FEF3C7] text-[#92600A]",
  FECHADA: "bg-[#F2F4F7] text-[#475467]",
  CANCELADA: "bg-[#FEE4E2] text-[#B42318]",
};

export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  ABERTA: ["PAUSADA", "FECHADA", "CANCELADA"],
  PAUSADA: ["ABERTA", "CANCELADA"],
  FECHADA: [],
  CANCELADA: [],
};

/** Seção 20: "vaga recebe pipeline configurável" — mesmo padrão de DEFAULT_PIPELINE_STAGE_NAMES (Oportunidades), semeado por vaga em vez de por agência. */
export const DEFAULT_JOB_STAGE_NAMES = ["Triagem", "Entrevista", "Proposta", "Contratado"];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONTRATADO: "Contratado",
  REJEITADO: "Rejeitado",
  DESISTIU: "Desistiu",
};

export const CANDIDATE_STATUS_BADGE_CLASS: Record<CandidateStatus, string> = {
  EM_ANDAMENTO: "bg-[#EEF2FF] text-[#3730A3]",
  CONTRATADO: "bg-[#DCFCE7] text-[#166534]",
  REJEITADO: "bg-[#FEE4E2] text-[#B42318]",
  DESISTIU: "bg-[#F2F4F7] text-[#98A2B3]",
};
