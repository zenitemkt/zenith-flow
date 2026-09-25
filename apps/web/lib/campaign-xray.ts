import type { CampaignDailyMetric } from "@zenite-mkt/db";

/**
 * "Tráfego - Raio X" (2026-09-25): agrega as métricas diárias já existentes
 * (seção 36, digitadas à mão) num painel único por campanha. Frequência,
 * ROI e ROAS são sempre calculados aqui — nunca guardados — pra nunca
 * divergirem da soma bruta do período exibido.
 */
export interface CampaignTotals {
  spendCents: number;
  impressions: number;
  clicks: number;
  reach: number;
  results: number;
  resultValueCents: number;
  /** impressões / alcance — null sem alcance reportado no período. */
  frequency: number | null;
  /** valor de resultado / gasto (ex.: 4.2 = "4,2x") — null sem gasto no período. */
  roas: number | null;
  /** (valor de resultado - gasto) / gasto, fração (0.2 = 20%) — null sem gasto no período. */
  roi: number | null;
}

type RawTotals = Pick<CampaignTotals, "spendCents" | "impressions" | "clicks" | "reach" | "results" | "resultValueCents">;

export function computeCampaignTotals(dailyMetrics: Pick<CampaignDailyMetric, "spendCents" | "impressions" | "clicks" | "reach" | "results" | "resultValueCents">[]): CampaignTotals {
  const initial: RawTotals = { spendCents: 0, impressions: 0, clicks: 0, reach: 0, results: 0, resultValueCents: 0 };
  const totals = dailyMetrics.reduce<RawTotals>(
    (acc, m) => ({
      spendCents: acc.spendCents + m.spendCents,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      reach: acc.reach + (m.reach ?? 0),
      results: acc.results + (m.results ?? 0),
      resultValueCents: acc.resultValueCents + (m.resultValueCents ?? 0),
    }),
    initial,
  );

  return {
    ...totals,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : null,
    roas: totals.spendCents > 0 ? totals.resultValueCents / totals.spendCents : null,
    roi: totals.spendCents > 0 ? (totals.resultValueCents - totals.spendCents) / totals.spendCents : null,
  };
}
