import type { TimesheetStatus } from "@zenite-mkt/db";

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  APROVADA: "Aprovada",
  CORRIGIDA: "Correção pedida",
};

/**
 * Seção 21 do manual: "rascunho -> enviado -> aprovado -> corrigido". Modelado
 * como um ciclo, não uma linha reta: o gestor pode pedir correção tanto antes
 * quanto depois de aprovar (erro percebido depois), e a pessoa sempre reenvia
 * pelo mesmo caminho — nunca perde o rascunho, só reabre pra edição.
 */
export const TIMESHEET_STATUS_TRANSITIONS: Record<TimesheetStatus, TimesheetStatus[]> = {
  RASCUNHO: ["ENVIADA"],
  ENVIADA: ["APROVADA", "CORRIGIDA"],
  APROVADA: ["CORRIGIDA"],
  CORRIGIDA: ["ENVIADA"],
};

export function canTransitionTimesheet(from: TimesheetStatus, to: TimesheetStatus): boolean {
  return TIMESHEET_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Segunda-feira (UTC) da semana que contém `date`. */
export function startOfWeekUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, "0")}`;
}

/**
 * Arredondamento padrão pra 15 min — seção 21: "arredondamento configurável"
 * (fixo por enquanto, ver DECISIONS.md). Nunca arredonda pra 0: qualquer
 * duração positiva vale pelo menos um incremento (15min) — um apontamento de
 * verdade não pode desaparecer só porque durou menos que o incremento.
 */
export function roundMinutes(minutes: number): number {
  return Math.max(15, Math.round(minutes / 15) * 15);
}
