import { unstable_cache } from "next/cache";
import { prisma, type FinanceCategoryNature, type FinanceEntryType } from "@zenith/db";
import { financeEntriesCacheTag } from "./finance-cache";

/**
 * Seção 26.2 do manual — cascata do DRE gerencial, por competência (seção
 * 26: "o financeiro separa três realidades... a interface deve permitir
 * alternar entre competência e caixa sem misturar conceitos" — DRE é sempre
 * competência, nunca caixa, conforme a seção 45.2/linha "DRE: demonstração
 * gerencial do resultado por competência").
 *
 * Receita bruta
 * - impostos/deduções
 * = receita líquida
 * - custos diretos de entrega
 * = margem de contribuição
 * - despesas operacionais
 * = EBITDA gerencial
 * - despesas financeiras
 * = resultado
 *
 * Investimento e Transferência ficam de fora do DRE de propósito — seção 33
 * (critério de aceite da Fase 2): "transferência não altera DRE". Investimento
 * também não é despesa do período, é aplicação de caixa.
 */

export interface DreEntryInput {
  amountCents: number;
  type: FinanceEntryType;
  /** Natureza da categoria do lançamento — `null` quando o lançamento não tem categoria. */
  nature: FinanceCategoryNature | null;
}

export interface DreResult {
  receitaBrutaCents: number;
  impostosCents: number;
  receitaLiquidaCents: number;
  custosDiretosCents: number;
  margemContribuicaoCents: number;
  despesasOperacionaisCents: number;
  ebitdaGerencialCents: number;
  despesasFinanceirasCents: number;
  resultadoCents: number;
}

/**
 * Lançamento sem categoria não pode ser classificado por natureza de
 * verdade — em vez de sumir silenciosamente do DRE (o que seria mais
 * confuso que aproximar), cai no padrão mais honesto por tipo: RECEITA vira
 * receita bruta, DESPESA vira despesa operacional (mesmo default usado na
 * criação de categoria nova, `FinanceCategory.nature`).
 */
function effectiveNature(entry: DreEntryInput): FinanceCategoryNature {
  return entry.nature ?? (entry.type === "RECEITA" ? "RECEITA" : "DESPESA_OPERACIONAL");
}

export function computeDre(entries: DreEntryInput[]): DreResult {
  const sumByNature = (nature: FinanceCategoryNature) =>
    entries.filter((e) => effectiveNature(e) === nature).reduce((sum, e) => sum + e.amountCents, 0);

  const receitaBrutaCents = sumByNature("RECEITA");
  const impostosCents = sumByNature("IMPOSTO_DEDUCAO");
  const receitaLiquidaCents = receitaBrutaCents - impostosCents;
  const custosDiretosCents = sumByNature("CUSTO_DIRETO");
  const margemContribuicaoCents = receitaLiquidaCents - custosDiretosCents;
  const despesasOperacionaisCents = sumByNature("DESPESA_OPERACIONAL");
  const ebitdaGerencialCents = margemContribuicaoCents - despesasOperacionaisCents;
  const despesasFinanceirasCents = sumByNature("DESPESA_FINANCEIRA");
  const resultadoCents = ebitdaGerencialCents - despesasFinanceirasCents;

  return {
    receitaBrutaCents,
    impostosCents,
    receitaLiquidaCents,
    custosDiretosCents,
    margemContribuicaoCents,
    despesasOperacionaisCents,
    ebitdaGerencialCents,
    despesasFinanceirasCents,
    resultadoCents,
  };
}

/**
 * Busca cacheada dos lançamentos do mês (a query em si, não o cálculo puro
 * de `computeDre` acima) — invalidada via `revalidateTag` sempre que uma
 * rota de `/api/finance/entries` grava em `FinanceEntry` (ver
 * `financeEntriesCacheTag`). Mês fechado navegado de novo não recalcula.
 */
export function getCachedDreEntries(agencyId: string, rangeStart: Date, rangeEnd: Date) {
  return unstable_cache(
    () =>
      prisma.financeEntry.findMany({
        where: {
          agencyId,
          status: { not: "CANCELADO" },
          competencyDate: { gte: rangeStart, lt: rangeEnd },
        },
        include: { category: { select: { nature: true } } },
      }),
    ["dre-entries", agencyId, rangeStart.toISOString(), rangeEnd.toISOString()],
    { tags: [financeEntriesCacheTag(agencyId)] },
  )();
}
