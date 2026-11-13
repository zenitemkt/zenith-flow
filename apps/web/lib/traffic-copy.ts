import { groupCreativesIntoAds, type AdGroup, type PairableCreative } from "@/lib/creative-pairing";

/** Textos e verba do plano de campanha: sem dependência de servidor (usado na tela e no envio). */
export interface PlanCopy {
  primaryTexts: string[];
  headlines: string[];
  descriptions: string[];
}
interface CopyPlan {
  copy: PlanCopy;
  splitCopy: boolean;
  copyGroups: PlanCopy[];
  copyByAd: Record<string, number>;
}
interface BudgetPlan {
  budgetMode: "CAMPAIGN" | "ADSET";
  campaignDailyBudget: number;
  adsets: { dailyBudget: number }[];
}

export const emptyCopy = (): PlanCopy => ({ primaryTexts: [], headlines: [], descriptions: [] });

/** Chave do criativo no conjunto para saber a qual grupo de textos ele pertence. */
export const adCopyKey = (adsetKey: string, creativeId: string) => `${adsetKey}:${creativeId}`;

/** Grupo (0 = grupo 1) de um criativo do conjunto. Cada criativo pertence a um grupo só. */
export function creativeGroup(plan: CopyPlan, adsetKey: string, creativeId: string): number {
  if (!plan.splitCopy) return 0;
  const index = plan.copyByAd[adCopyKey(adsetKey, creativeId)] ?? 0;
  return index <= plan.copyGroups.length ? index : 0;
}

/** Textos que um anúncio usa: os do grupo do criativo principal (ou o grupo 1). */
export function copyForAd(plan: CopyPlan, adsetKey: string, mainCreativeId: string): PlanCopy {
  const index = creativeGroup(plan, adsetKey, mainCreativeId);
  return (index === 0 ? plan.copy : plan.copyGroups[index - 1]) ?? plan.copy;
}

/**
 * Anúncios do conjunto: os criativos de cada grupo de textos formam seus próprios anúncios
 * (o par Feed/Stories só se junta dentro do mesmo grupo). Numeração AD01, AD02... segue a ordem dos grupos.
 */
export function adsForAdSet<T extends PairableCreative>(plan: CopyPlan, adsetKey: string, items: T[]): (AdGroup<T> & { copyGroup: number })[] {
  const groups = plan.splitCopy ? plan.copyGroups.length + 1 : 1;
  const out: (AdGroup<T> & { copyGroup: number })[] = [];
  for (let g = 0; g < groups; g++) {
    for (const ad of groupCreativesIntoAds(items.filter((c) => creativeGroup(plan, adsetKey, c.id) === g))) out.push({ ...ad, copyGroup: g });
  }
  return out;
}

/** Verba diária total quando tudo estiver ativo. */
export function planDailyTotal(plan: BudgetPlan): number {
  return plan.budgetMode === "CAMPAIGN" ? Number(plan.campaignDailyBudget) || 0 : plan.adsets.reduce((sum, a) => sum + (Number(a.dailyBudget) || 0), 0);
}

