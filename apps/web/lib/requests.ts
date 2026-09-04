import type { RequestStatus, RequestPriority } from "@zenith/db";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  NOVA: "Nova",
  TRIAGEM: "Em triagem",
  AGUARDANDO_INFORMACAO: "Aguardando informação",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  CONVERTIDA: "Convertida",
  CONCLUIDA: "Concluída",
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

/**
 * Seção 13 do manual: nova -> triagem -> aguardando informação -> aprovada/rejeitada
 * -> convertida -> concluída. APROVADA -> CONVERTIDA não está aqui de propósito:
 * essa transição só acontece via POST /api/requests/:id/convert (precisa saber
 * em qual projeto a tarefa entra), nunca pela ação genérica de status.
 */
export const REQUEST_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  NOVA: ["TRIAGEM"],
  TRIAGEM: ["AGUARDANDO_INFORMACAO", "APROVADA", "REJEITADA"],
  AGUARDANDO_INFORMACAO: ["TRIAGEM"],
  APROVADA: [],
  REJEITADA: [],
  CONVERTIDA: ["CONCLUIDA"],
  CONCLUIDA: [],
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
