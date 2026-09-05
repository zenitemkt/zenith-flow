/**
 * Seção 29 do manual: "Indicadores financeiros". Só os dois indicadores que
 * NÃO dependem de receita recorrente (MRR) entram aqui — MRR, ARR, ARPA,
 * Gross/Net Revenue Churn e LTV simples pressupõem "receita mensal
 * recorrente ativa normalizada", e este projeto decidiu (Release 1B) não
 * modelar contrato/assinatura como entidade própria — calcular "MRR" a
 * partir de lançamentos avulsos seria inventar um número sem lastro, o
 * mesmo motivo que já manteve MRR fora da Home v2. CAC é Fase 3 (precisa de
 * dado de aquisição/marketing). Margem cliente precisa de custo por hora —
 * dado sensível (relacionado a salário) que a seção 20 (RH) já evitou de
 * propósito até haver caso real pedindo.
 *
 * DSO e Logo Churn não têm essa dependência — dá pra calcular hoje, de
 * verdade, com `FinanceEntry` e `ClientStatusHistory` que já existem.
 */

export const INDICATOR_WINDOW_DAYS = 90;

/** DSO = contas a receber / receita a prazo do período × dias do período. */
export function computeDSO(accountsReceivableCents: number, creditSalesCentsForPeriod: number, days: number): number | null {
  if (creditSalesCentsForPeriod <= 0) return null;
  return Math.round((accountsReceivableCents / creditSalesCentsForPeriod) * days);
}

/** Logo churn = clientes cancelados no período / clientes ativos no início do período. */
export function computeLogoChurnRate(clientsAtStart: number, churnedInPeriod: number): number | null {
  if (clientsAtStart <= 0) return null;
  return Math.round((churnedInPeriod / clientsAtStart) * 100);
}
