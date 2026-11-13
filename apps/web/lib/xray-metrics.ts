/**
 * Tráfego - Raio X (fase 2B): números de cada nível (campanha, conjunto, anúncio) somados no
 * período e as métricas derivadas. Sem dependência de servidor (usado na página e na árvore).
 */
export interface LevelTotals {
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
}

export const EMPTY_TOTALS: LevelTotals = { spendCents: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 };

type MetricLike = { spendCents: number; impressions: number; reach?: number | null; clicks: number; leads?: number | null; results?: number | null };

export function sumLevel(rows: MetricLike[]): LevelTotals {
  return rows.reduce<LevelTotals>(
    (acc, r) => ({
      spendCents: acc.spendCents + r.spendCents,
      impressions: acc.impressions + r.impressions,
      reach: acc.reach + (r.reach ?? 0),
      clicks: acc.clicks + r.clicks,
      leads: acc.leads + (r.leads ?? r.results ?? 0),
    }),
    { ...EMPTY_TOTALS },
  );
}

/** Custo por lead em centavos (null sem lead). */
export const cplCents = (t: LevelTotals) => (t.leads > 0 ? Math.round(t.spendCents / t.leads) : null);
/** Taxa de cliques (fração). */
export const ctr = (t: LevelTotals) => (t.impressions > 0 ? t.clicks / t.impressions : null);
/** Frequência = impressões / alcance (o alcance somado por dia é aproximado). */
export const frequency = (t: LevelTotals) => (t.reach > 0 ? t.impressions / t.reach : null);

export type CplLevel = "good" | "warning" | "critical" | "none";

/**
 * Situação do custo por lead frente às metas de Configurações do Gestor de tráfego.
 * Sem lead mas com gasto acima do máximo também é crítico.
 */
export function cplLevel(t: LevelTotals, goodCents: number | null, maxCents: number | null): CplLevel {
  const cpl = cplCents(t);
  if (cpl === null) return maxCents && t.spendCents > maxCents ? "critical" : "none";
  if (maxCents && cpl > maxCents) return "critical";
  if (goodCents && cpl <= goodCents) return "good";
  if (goodCents || maxCents) return "warning";
  return "none";
}

export const CPL_LEVEL_LABEL: Record<CplLevel, string> = { good: "bom", warning: "atenção", critical: "acima do máximo", none: "" };

/** Situação do anúncio/conjunto na Meta (effective_status) em português. */
export const META_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "No ar",
  PAUSED: "Pausado",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
  PENDING_REVIEW: "Em análise",
  IN_PROCESS: "Processando",
  PREAPPROVED: "Pré-aprovado",
  DISAPPROVED: "Reprovado",
  WITH_ISSUES: "Com problemas",
  ARCHIVED: "Arquivado",
  DELETED: "Excluído",
  PENDING_BILLING_INFO: "Pendente de pagamento",
};
