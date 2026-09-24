/**
 * Vocabulário de status compartilhado pelas listas do Portal que mostram
 * `Task` pro cliente (Solicitações, Peças gráficas) — versão simplificada
 * do `WORK_ITEM_STATUS_LABELS` interno (`lib/tasks.ts`), que tem mais
 * granularidade do que faz sentido expor pro cliente.
 */
export const PORTAL_REQUEST_STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Recebida",
  PLANEJADA: "Recebida",
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADA: "Em andamento",
  REVISAO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const PORTAL_REQUEST_STATUS_BADGE_CLASS: Record<string, string> = {
  BACKLOG: "bg-[#F2F4F7] text-[#475467]",
  PLANEJADA: "bg-[#F2F4F7] text-[#475467]",
  EM_ANDAMENTO: "bg-[#EEF2FF] text-[#3730A3]",
  BLOQUEADA: "bg-[#EEF2FF] text-[#3730A3]",
  REVISAO: "bg-[#EEF2FF] text-[#3730A3]",
  CONCLUIDA: "bg-[#DCFCE7] text-[#166534]",
  CANCELADA: "bg-[#FEE4E2] text-[#B42318]",
};

/**
 * Cotação gráfica (pedido do Kevin, 2026-09-24) reaproveita 100% o mesmo
 * caminho de "Solicitações" (`POST /api/portal/requests` → `Task` sem
 * responsável, cai em "Não atribuída" no Operação) — sem tabela nova. A
 * única diferença é um formulário estruturado em vez de texto livre; o
 * título sempre começa com esse marcador, usado só pra filtrar a lista
 * "Peças gráficas" separada da lista genérica de Solicitações.
 *
 * Simplificação deliberada: é uma checagem por prefixo de texto, não uma
 * coluna própria no banco — se algum dia o cliente conseguir digitar um
 * título livre começando com esse texto exato numa Solicitação genérica,
 * ele apareceria (incorretamente) também aqui. Risco aceitável pra uma
 * equipe pequena e baixo volume; se isso incomodar no uso real, o próximo
 * passo é uma coluna `Task.kind` de verdade.
 */
export const GRAPHIC_REQUEST_TAG = "[Gráfica]";

export const GRAPHIC_ITEM_TYPES = [
  "Cartão de visita",
  "Panfleto",
  "Placa",
  "Banner",
  "Lona",
  "Adesivo",
  "Outro",
] as const;
