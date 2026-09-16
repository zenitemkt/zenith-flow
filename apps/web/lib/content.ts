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
 * Seção 17 do manual: ideia -> produção -> revisão interna -> aguardando
 * cliente -> ajustes -> aprovado -> agendado -> publicado -> arquivado.
 * "Pauta" foi removida do fluxo (pedido do usuário, 2026-09-15) — o enum
 * continua existindo por compatibilidade com itens antigos, mas nada novo
 * passa por ela; IDEIA vai direto pra PRODUCAO.
 * Usado só para sugerir o próximo passo na página do conteúdo
 * (ContentStatusActions) — não bloqueia mais mudanças fora dessa ordem,
 * porque o card pode ter avançado fora do sistema (ex.: cliente aprovou
 * pelo WhatsApp) e o board de Operação permite arrastar entre quaisquer
 * colunas (pedido do usuário, 2026-09-16).
 */
export const CONTENT_STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  IDEIA: ["PRODUCAO"],
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
  return from !== to;
}

/** Estados a partir dos quais dá pra enviar a versão mais recente para aprovação do cliente. */
export const SUBMITTABLE_STATUSES: ContentStatus[] = ["REVISAO_INTERNA", "AJUSTES"];

export const CONTENT_STATUS_BADGE_CLASS: Record<ContentStatus, string> = {
  IDEIA: "bg-[#F2F4F7] text-[#475467]",
  PAUTA: "bg-[#F2F4F7] text-[#475467]",
  PRODUCAO: "bg-[#EEF2FF] text-[#3730A3]",
  REVISAO_INTERNA: "bg-[#EEF2FF] text-[#3730A3]",
  AGUARDANDO_CLIENTE: "bg-[#FEF3C7] text-[#92600A]",
  AJUSTES: "bg-[#FEE4E2] text-[#B42318]",
  APROVADO: "bg-[#DCFCE7] text-[#166534]",
  AGENDADO: "bg-[#DCFCE7] text-[#166534]",
  PUBLICADO: "bg-[#DCFCE7] text-[#166534]",
  ARQUIVADO: "bg-[#F2F4F7] text-[#98A2B3]",
};

/**
 * Kanban de Operação (seção 40+): pipeline de conteúdo com 5 baldes fixos.
 * "Aguardando aprovação" cobre tanto revisão interna quanto aguardando
 * decisão do cliente — a saída desse balde é automática (decisão do
 * cliente via link público) ou por um botão de ação no card, nunca por
 * drag livre.
 */
export type ContentBoardColumnId = "a_fazer" | "fazendo" | "aguardando_aprovacao" | "agendar" | "concluido";

export const CONTENT_BOARD_COLUMNS: { id: ContentBoardColumnId; title: string; statuses: ContentStatus[] }[] = [
  { id: "a_fazer", title: "A Fazer", statuses: ["IDEIA", "PAUTA"] },
  { id: "fazendo", title: "Fazendo", statuses: ["PRODUCAO", "AJUSTES"] },
  { id: "aguardando_aprovacao", title: "Aguardando aprovação", statuses: ["REVISAO_INTERNA", "AGUARDANDO_CLIENTE"] },
  { id: "agendar", title: "Agendar", statuses: ["APROVADO"] },
  { id: "concluido", title: "Concluído", statuses: ["AGENDADO", "PUBLICADO"] },
];

export function contentBoardColumnForStatus(status: ContentStatus): ContentBoardColumnId {
  return CONTENT_BOARD_COLUMNS.find((c) => c.statuses.includes(status))?.id ?? "a_fazer";
}

/**
 * Cor do card no Calendário (pedido do usuário, 2026-09-15): cinza = ainda
 * não começou a ser produzido, laranja = em andamento em qualquer etapa até
 * "Agendar", verde = já concluído (Agendado/Publicado). Independe da data —
 * a presença no calendário já é filtrada por scheduledDate em outro lugar.
 */
export type ContentCalendarBucket = "todo" | "doing" | "done";

const CALENDAR_BUCKET_BY_STATUS: Record<ContentStatus, ContentCalendarBucket> = {
  IDEIA: "todo",
  PAUTA: "todo",
  PRODUCAO: "doing",
  REVISAO_INTERNA: "doing",
  AGUARDANDO_CLIENTE: "doing",
  AJUSTES: "doing",
  APROVADO: "doing",
  AGENDADO: "done",
  PUBLICADO: "done",
  ARQUIVADO: "todo",
};

export function contentCalendarBucket(status: ContentStatus): ContentCalendarBucket {
  return CALENDAR_BUCKET_BY_STATUS[status];
}

export const CONTENT_CALENDAR_BUCKET_CLASS: Record<ContentCalendarBucket, string> = {
  todo: "bg-[#F2F4F7] text-[#475467]",
  doing: "bg-[#FFEDD5] text-[#9A3412]",
  done: "bg-[#DCFCE7] text-[#166534]",
};
