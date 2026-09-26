import type { LeadStatus } from "@zenite-mkt/db";

/** Seção 39: "Lead: new -> working -> qualified -> disqualified -> converted." */
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: "Novo",
  EM_ANDAMENTO: "Em andamento",
  QUALIFICADO: "Qualificado",
  DESQUALIFICADO: "Desqualificado",
  CONVERTIDO: "Convertido",
};

export const LEAD_STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
  NOVO: "bg-[#F2F4F7] text-[#475467]",
  EM_ANDAMENTO: "bg-[#EEF2FF] text-[#3730A3]",
  QUALIFICADO: "bg-[#DCFCE7] text-[#166534]",
  DESQUALIFICADO: "bg-[#FEE4E2] text-[#B42318]",
  CONVERTIDO: "bg-[#DCFCE7] text-[#166534]",
};

export const LEAD_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NOVO: ["EM_ANDAMENTO", "DESQUALIFICADO"],
  EM_ANDAMENTO: ["QUALIFICADO", "DESQUALIFICADO"],
  QUALIFICADO: ["CONVERTIDO", "DESQUALIFICADO"],
  DESQUALIFICADO: ["EM_ANDAMENTO"],
  CONVERTIDO: [],
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Seção 39.1: "e-mail normalizado é chave primária operacional." */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed ? trimmed : null;
}
const SITE_DETAIL_LABELS = ["Cidade", "Interesse", "Serviço", "Funcionários", "Investimento mensal", "Resumo"] as const;
export type SiteLeadDetailLabel = (typeof SITE_DETAIL_LABELS)[number];

export function parseSiteLeadDetails(body: string): Partial<Record<SiteLeadDetailLabel, string>> | null {
  const details: Partial<Record<SiteLeadDetailLabel, string>> = {};
  for (const line of body.split("\n")) {
    const label = SITE_DETAIL_LABELS.find((candidate) => line.startsWith(`${candidate}: `));
    if (label) details[label] = line.slice(label.length + 2).trim();
  }
  return Object.keys(details).length > 0 ? details : null;
}