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

/** Chave do anúncio para escolher o grupo de textos (o criativo de Feed, ou o único). */
export const adCopyKey = (adsetKey: string, mainCreativeId: string) => `${adsetKey}:${mainCreativeId}`;

/** Textos que um anúncio usa: o grupo escolhido (se os grupos estiverem ligados) ou o grupo 1. */
export function copyForAd(plan: CopyPlan, adsetKey: string, mainCreativeId: string): PlanCopy {
  if (!plan.splitCopy) return plan.copy;
  const index = plan.copyByAd[adCopyKey(adsetKey, mainCreativeId)] ?? 0;
  return (index === 0 ? plan.copy : plan.copyGroups[index - 1]) ?? plan.copy;
}

/** Verba diária total quando tudo estiver ativo. */
export function planDailyTotal(plan: BudgetPlan): number {
  return plan.budgetMode === "CAMPAIGN" ? Number(plan.campaignDailyBudget) || 0 : plan.adsets.reduce((sum, a) => sum + (Number(a.dailyBudget) || 0), 0);
}

