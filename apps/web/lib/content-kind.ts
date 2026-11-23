import type { ContentKind, ContentStatus } from "@zenite-mkt/db";

/**
 * Tipo do cartão de Operação (2026-11-22, pedido do usuário).
 *
 * - DESIGN: arte, vídeo, carrossel… Fluxo completo (versões, aprovação do
 *   cliente, agendamento, publicação nas redes) e campos de rede/formato/tamanho.
 * - Demais tipos (ligação, fechamento financeiro, ajuste no site…): fluxo curto
 *   A Fazer → Fazendo → Concluído, sem campos de design, sem portal do cliente.
 *
 * O fluxo curto reaproveita os status existentes: IDEIA (A fazer),
 * PRODUCAO (Fazendo) e PUBLICADO (Concluído), mostrados com rótulos de tarefa.
 */
export const CONTENT_KINDS: ContentKind[] = ["DESIGN", "ATENDIMENTO", "FINANCEIRO", "SITE", "OUTROS"];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  DESIGN: "Design",
  ATENDIMENTO: "Atendimento",
  FINANCEIRO: "Financeiro",
  SITE: "Site / Tecnologia",
  OUTROS: "Outros",
};

export const CONTENT_KIND_HINTS: Record<ContentKind, string> = {
  DESIGN: "Arte, vídeo, carrossel: tem tamanhos, aprovação do cliente e publicação.",
  ATENDIMENTO: "Ligar, reunião, dar retorno ao cliente.",
  FINANCEIRO: "Fechamento mensal, cobrança, nota fiscal.",
  SITE: "Ajuste no site, landing page, integrações.",
  OUTROS: "Qualquer outra demanda da agência.",
};

/** Etiqueta do tipo no card (cores suaves, distintas das de status). */
export const CONTENT_KIND_BADGE_CLASS: Record<ContentKind, string> = {
  DESIGN: "bg-[#FFF1EC] text-[#C2270A]",
  ATENDIMENTO: "bg-[#E0F2FE] text-[#075985]",
  FINANCEIRO: "bg-[#DCFCE7] text-[#166534]",
  SITE: "bg-[#F3E8FF] text-[#6B21A8]",
  OUTROS: "bg-[#F2F4F7] text-[#475467]",
};

export function isDesignKind(kind: ContentKind | null | undefined): boolean {
  return !kind || kind === "DESIGN";
}

export function parseContentKind(value: unknown): ContentKind {
  return typeof value === "string" && (CONTENT_KINDS as string[]).includes(value) ? (value as ContentKind) : "DESIGN";
}

/** Status permitidos no fluxo curto, na ordem das etapas. */
export const TASK_FLOW_STATUSES: ContentStatus[] = ["IDEIA", "PRODUCAO", "PUBLICADO"];

const TASK_STATUS_LABELS: Partial<Record<ContentStatus, string>> = {
  IDEIA: "A fazer",
  PAUTA: "A fazer",
  PRODUCAO: "Fazendo",
  PUBLICADO: "Concluído",
  AGENDADO: "Concluído",
  ARQUIVADO: "Arquivado",
};

/** Rótulo do status considerando o tipo (tarefa não "publica", conclui). */
export function contentStatusLabelFor(kind: ContentKind, status: ContentStatus, designLabels: Record<ContentStatus, string>): string {
  if (isDesignKind(kind)) return designLabels[status];
  return TASK_STATUS_LABELS[status] ?? designLabels[status];
}

/** Tarefa comum só pode ir para A fazer, Fazendo, Concluído ou Arquivado. */
export function canKindUseStatus(kind: ContentKind, status: ContentStatus): boolean {
  if (isDesignKind(kind)) return true;
  return status === "ARQUIVADO" || TASK_FLOW_STATUSES.includes(status);
}

/** Próximo passo sugerido para tarefa comum (botão principal no card e no detalhe). */
export function nextTaskStatus(status: ContentStatus): ContentStatus | null {
  if (status === "IDEIA" || status === "PAUTA") return "PRODUCAO";
  if (status === "PRODUCAO") return "PUBLICADO";
  if (status === "PUBLICADO" || status === "AGENDADO") return "ARQUIVADO";
  return null;
}

/**
 * Ações de status no detalhe de uma tarefa comum: primeiro o próximo passo,
 * depois o caminho de volta (reabrir/voltar), com rótulos de tarefa.
 */
export function taskStatusActions(status: ContentStatus): { options: ContentStatus[]; labels: Partial<Record<ContentStatus, string>> } {
  if (status === "IDEIA" || status === "PAUTA") return { options: ["PRODUCAO"], labels: { PRODUCAO: "Iniciar" } };
  if (status === "PRODUCAO") return { options: ["PUBLICADO", "IDEIA"], labels: { PUBLICADO: "Concluir", IDEIA: "Voltar para A fazer" } };
  if (status === "PUBLICADO" || status === "AGENDADO") return { options: ["ARQUIVADO", "PRODUCAO"], labels: { ARQUIVADO: "Arquivar", PRODUCAO: "Reabrir" } };
  return { options: [], labels: {} };
}
