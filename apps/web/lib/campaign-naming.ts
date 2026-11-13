import { metaGet } from "@/lib/meta-marketing";

/**
 * Padrão de nome das campanhas da Zenite: "[CÓDIGO##] Nome", com o código do objetivo e número
 * sequencial por objetivo na conta de anúncios (ex.: [LEAD01], [LEAD02], [VEND01]).
 */
export const OBJECTIVE_CODES = {
  OUTCOME_AWARENESS: "REC",
  OUTCOME_TRAFFIC: "TRAF",
  OUTCOME_ENGAGEMENT: "ENG",
  OUTCOME_LEADS: "LEAD",
  OUTCOME_APP_PROMOTION: "APP",
  OUTCOME_SALES: "VEND",
} as const;

export type ObjectiveCode = (typeof OBJECTIVE_CODES)[keyof typeof OBJECTIVE_CODES];

const PREFIX = /^\s*\[([A-Z]+)(\d+)\]\s*/;

/** Tira um "[XXX00]" que já esteja no começo (evita "[LEAD03] [LEAD02] ..."). */
export function stripCampaignCode(name: string): string {
  return name.replace(PREFIX, "").trim();
}

export function withCampaignCode(code: string, number: number, name: string): string {
  return `[${code}${String(number).padStart(2, "0")}] ${stripCampaignCode(name)}`;
}

/** Maior número já usado para o código, lendo todas as campanhas da conta (inclusive pausadas e arquivadas). */
export async function nextCampaignNumber(token: string, adAccountId: string, code: string, extraNames: string[] = []): Promise<number> {
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const names: string[] = [...extraNames];
  let after = "";
  for (let page = 0; page < 20; page++) {
    const data = await metaGet<{ data?: { name: string }[]; paging?: { cursors?: { after?: string }; next?: string } }>(`/${act}/campaigns`, token, {
      fields: "name",
      limit: 200,
      effective_status: ["ACTIVE", "PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"],
      ...(after ? { after } : {}),
    });
    names.push(...(data.data ?? []).map((c) => c.name));
    after = data.paging?.next ? data.paging.cursors?.after ?? "" : "";
    if (!after) break;
  }
  let max = 0;
  for (const name of names) {
    const match = name.match(PREFIX);
    if (match && match[1] === code) max = Math.max(max, Number(match[2]));
  }
  return max + 1;
}
