import type { ContentStatus, ContentChannel } from "@zenith/db";

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  IDEIA: "Ideia",
  PAUTA: "Pauta",
  PRODUCAO: "Produção",
  REVISAO_INTERNA: "Revisão interna",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  AJUSTES: "Ajustes",
  APROVADO: "Aprovado",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
  ARQUIVADO: "Arquivado",
};

export const CONTENT_CHANNEL_LABELS: Record<ContentChannel, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  OUTRO: "Outro",
};

/**
 * Seção 17 do manual: ideia -> pauta -> produção -> revisão interna ->
 * aguardando cliente -> ajustes -> aprovado -> agendado -> publicado -> arquivado.
 * AGUARDANDO_CLIENTE não tem transição manual daqui — só sai desse estado
 * via decisão do cliente no link público (POST /api/approvals/:token).
 */
export const CONTENT_STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  IDEIA: ["PAUTA"],
  PAUTA: ["PRODUCAO"],
  PRODUCAO: ["REVISAO_INTERNA"],
  REVISAO_INTERNA: ["PRODUCAO"], // enviar para o cliente é uma ação própria (submit), não uma transição genérica
  AGUARDANDO_CLIENTE: [],
  AJUSTES: ["PRODUCAO"],
  APROVADO: ["AGENDADO"],
  AGENDADO: ["PUBLICADO"],
  PUBLICADO: ["ARQUIVADO"],
  ARQUIVADO: [],
};

export function canTransitionContent(from: ContentStatus, to: ContentStatus): boolean {
  return CONTENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Estados a partir dos quais dá pra enviar a versão mais recente para aprovação do cliente. */
export const SUBMITTABLE_STATUSES: ContentStatus[] = ["REVISAO_INTERNA", "AJUSTES"];
