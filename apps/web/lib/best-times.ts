import type { SocialPlatform } from "@zenite-mkt/db";

/**
 * Melhor horário de publicação por rede e dia da semana (fuso de São Paulo).
 * Base interna — não aparece em nenhuma tela além do botão "Melhor horário".
 *
 * Pesquisa de 2026-10-22, cruzando estudos de 2026 (nenhuma fonte sozinha):
 *  - Sprout Social (31/03/2026; ~2 bi de interações, nov/2025 a fev/2026)
 *  - Buffer (25/03/2026; 52 mi de posts, ~10 mi no Instagram)
 *  - Hootsuite (via Nuvemshop, 26/07/2026)
 *  - Metricool (via Post2Go / Paulo Coutinho)
 *  - Agência Gram (20/04/2026) e Pubbly (17/07/2026): médias de perfis brasileiros
 *  - Influencer Marketing Hub (22/09/2026): Facebook
 * Critério: horário onde as fontes mais se sobrepõem, dando mais peso aos dados
 * de perfis brasileiros. Sexta a domingo no Facebook têm pouca evidência (baixa
 * confiança). Os Insights da conta do cliente sempre valem mais que esta tabela.
 *
 * Para atualizar ("atualize a base de melhores horários"): refazer a pesquisa e
 * trocar só os valores abaixo, mais a data acima.
 */
export const BEST_TIMES_RESEARCHED_AT = "2026-10-22";

/** Índice 0 = domingo … 6 = sábado (igual a Date.getUTCDay). */
const BEST_TIMES: Partial<Record<SocialPlatform, readonly string[]>> = {
  INSTAGRAM: ["11:00", "12:00", "12:00", "12:00", "13:00", "11:00", "10:00"],
  FACEBOOK: ["09:00", "12:00", "13:00", "14:00", "09:00", "10:00", "09:00"],
};

export const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

/** Dia da semana (0 = domingo) de uma data `AAAA-MM-DD`; null se inválida. */
export function weekdayOf(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

/** Melhor horário (`HH:MM`) da rede na data informada; null se a data ou a rede não tiver dado. */
export function bestTimeFor(platform: SocialPlatform, date: string): string | null {
  const day = weekdayOf(date);
  if (day === null) return null;
  return BEST_TIMES[platform]?.[day] ?? null;
}
