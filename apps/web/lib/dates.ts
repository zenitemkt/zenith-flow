/**
 * "Vencimento" é um dia inteiro, não um instante — comparar um `dueDate`
 * (sempre meia-noite UTC do dia escolhido no `<input type="date">`) direto
 * contra `new Date()` faz qualquer coisa vencendo "hoje" já aparecer como
 * atrasada a partir da 00:00:01. Helpers centralizados aqui pra não repetir
 * esse erro em cada módulo que lida com prazo (Financeiro, Tarefas, Health
 * Score).
 */

export function endOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Só considera vencido depois que o dia inteiro do vencimento já passou. */
export function isPastDueDate(dueDate: Date, now: Date = new Date()): boolean {
  return endOfDayUTC(dueDate) < now;
}
