/**
 * Seção 32.2 do manual: "agrupar clientes por mês de início, canal, produto
 * ou squad e acompanhar retenção e receita ao longo dos meses. O dashboard
 * deve distinguir logo retention de revenue retention."
 *
 * Só a dimensão "mês de início" é implementada nesta fatia — é a única com
 * dado real e inequívoco hoje (a data em que o cliente virou `ATIVO`, via
 * `ClientStatusHistory`). "Canal" e "produto" não existem no schema (não há
 * campo de origem de aquisição nem entidade de produto/contrato formal —
 * decisão já tomada de não modelar contrato). "Squad" existe (`ClientAllocation`)
 * mas puxaria uma segunda dimensão de agrupamento sem um caso de uso real
 * pedindo ainda — mesma régua pragmática usada em Health Score/Risco de
 * churn (só implementar o que tem dado real, documentar o resto como
 * pendente). Ver docs/DECISIONS.md.
 */

export const COHORT_MONTH_WINDOW = 6;

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function monthLabel(key: string): string {
  const parts = key.split("-").map(Number);
  const year = parts[0]!;
  const month = parts[1]!;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
}

interface ClientCohortInput {
  clientId: string;
  /// Mês (UTC, dia 1) em que o cliente virou ATIVO pela primeira vez.
  cohortMonthStart: Date;
  /// Histórico de status ordenado por data — usado pra saber se o cliente
  /// estava "vivo" (não ENCERRADO) num mês de referência qualquer.
  statusEvents: { toStatus: string; createdAt: Date }[];
}

interface RevenueInput {
  clientId: string;
  /// Mês (UTC, dia 1) da liquidação.
  monthStart: Date;
  amountCents: number;
}

export interface CohortRow {
  cohortMonth: string;
  cohortLabel: string;
  clientCount: number;
  /// Índice = offset em meses desde o início do cohort. `null` = mês ainda no futuro (sem dado).
  logoRetention: (number | null)[];
  revenueRetention: (number | null)[];
}

/// Status da última transição de um cliente até (e incluindo) uma data de
/// referência qualquer — reativação depois de encerrado volta a contar como
/// "vivo". Exportado porque `lib/finance-indicators.ts` (logo churn) precisa
/// da mesma checagem "estava ativo nesta data?", não só o cohort.
export function statusAsOf(events: { toStatus: string; createdAt: Date }[], referenceMonthEnd: Date): string | null {
  let last: string | null = null;
  for (const event of events) {
    if (event.createdAt <= referenceMonthEnd) {
      last = event.toStatus;
    }
  }
  return last;
}

export function buildCohortRows(clients: ClientCohortInput[], revenue: RevenueInput[], now: Date): CohortRow[] {
  const cohortsByMonth = new Map<string, ClientCohortInput[]>();
  for (const client of clients) {
    const key = monthKey(client.cohortMonthStart);
    if (!cohortsByMonth.has(key)) cohortsByMonth.set(key, []);
    cohortsByMonth.get(key)!.push(client);
  }

  const revenueByClientMonth = new Map<string, Map<string, number>>();
  for (const r of revenue) {
    if (!revenueByClientMonth.has(r.clientId)) revenueByClientMonth.set(r.clientId, new Map());
    const monthMap = revenueByClientMonth.get(r.clientId)!;
    monthMap.set(monthKey(r.monthStart), (monthMap.get(monthKey(r.monthStart)) ?? 0) + r.amountCents);
  }

  const currentMonthStart = startOfMonthUTC(now);

  const rows: CohortRow[] = Array.from(cohortsByMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([cohortMonth, cohortClients]) => {
      const cohortMonthStart = cohortClients[0]!.cohortMonthStart;
      const logoRetention: (number | null)[] = [];
      const revenueRetention: (number | null)[] = [];
      let baselineRevenue: number | null = null;

      for (let offset = 0; offset < COHORT_MONTH_WINDOW; offset++) {
        const referenceMonthStart = addMonthsUTC(cohortMonthStart, offset);
        if (referenceMonthStart > currentMonthStart) {
          logoRetention.push(null);
          revenueRetention.push(null);
          continue;
        }
        const referenceMonthEnd = new Date(addMonthsUTC(referenceMonthStart, 1).getTime() - 1);

        const alive = cohortClients.filter((c) => {
          const status = statusAsOf(c.statusEvents, referenceMonthEnd);
          return status !== "ENCERRADO";
        }).length;
        logoRetention.push(Math.round((alive / cohortClients.length) * 100));

        const referenceKey = monthKey(referenceMonthStart);
        const monthRevenue = cohortClients.reduce(
          (sum, c) => sum + (revenueByClientMonth.get(c.clientId)?.get(referenceKey) ?? 0),
          0,
        );
        if (offset === 0) baselineRevenue = monthRevenue;
        revenueRetention.push(
          baselineRevenue && baselineRevenue > 0 ? Math.round((monthRevenue / baselineRevenue) * 100) : null,
        );
      }

      return {
        cohortMonth,
        cohortLabel: monthLabel(cohortMonth),
        clientCount: cohortClients.length,
        logoRetention,
        revenueRetention,
      };
    });

  return rows;
}
