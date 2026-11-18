import { prisma } from "@zenite-mkt/db";
import { syncCompetitorSeo } from "@/lib/competitor-seo";

const ENDPOINT = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

export function normalizeWebsiteUrl(raw: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function effectiveCompetitorWebsite(competitor: { website: string | null; websiteOverride: string | null }): string | null {
  return normalizeWebsiteUrl(competitor.websiteOverride) ?? normalizeWebsiteUrl(competitor.website);
}

export interface PageSpeedScores { performance: number; seo: number | null }

/** Performance e SEO do Lighthouse numa chamada só (mesma cota da PageSpeed API). */
export async function fetchPageSpeedScores(rawUrl: string): Promise<PageSpeedScores> {
  const website = normalizeWebsiteUrl(rawUrl);
  if (!website) throw new Error("O endereço do site é inválido.");
  const url = new URL(ENDPOINT);
  url.searchParams.set("url", website);
  url.searchParams.set("strategy", "mobile");
  url.searchParams.append("category", "performance");
  url.searchParams.append("category", "seo");
  url.searchParams.set("locale", "pt_BR");
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY?.trim();
  if (apiKey) url.searchParams.set("key", apiKey);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
  const body = await response.json().catch(() => null) as { lighthouseResult?: { categories?: { performance?: { score?: number | null }; seo?: { score?: number | null } } }; error?: { message?: string } } | null;
  if (!response.ok) {
    const detail = body?.error?.message ?? `erro ${response.status}`;
    if (response.status === 429 || /quota exceeded/i.test(detail)) throw new Error("Limite diário do PageSpeed atingido. Tente novamente amanhã ou configure GOOGLE_PAGESPEED_API_KEY.");
    throw new Error(`PageSpeed: ${detail}`);
  }
  const perf = body?.lighthouseResult?.categories?.performance?.score;
  if (typeof perf !== "number") throw new Error("O PageSpeed não devolveu uma nota de performance.");
  const seo = body?.lighthouseResult?.categories?.seo?.score;
  const pct = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100);
  return { performance: pct(perf), seo: typeof seo === "number" ? pct(seo) : null };
}

export async function fetchPageSpeedScore(rawUrl: string): Promise<number> {
  return (await fetchPageSpeedScores(rawUrl)).performance;
}

export async function syncCompetitorWebsite(competitorId: string) {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId }, select: { website: true, websiteOverride: true } });
  if (!competitor) throw new Error("Concorrente não encontrado.");
  const website = effectiveCompetitorWebsite(competitor);
  if (!website) {
    await prisma.competitor.update({ where: { id: competitorId }, data: { websiteScoreError: "Este perfil não informa um site válido." } });
    throw new Error("Este perfil não informa um site válido.");
  }
  try {
    const scores = await fetchPageSpeedScores(website);
    await prisma.competitor.update({ where: { id: competitorId }, data: { websiteScore: scores.performance, websiteSeoScore: scores.seo, websiteScoreAt: new Date(), websiteScoreError: null } });
    // SEO on-page roda junto: mesmo site, mesmo botão "Medir site".
    await syncCompetitorSeo(competitorId, website).catch((error) => console.error("competitor_seo_sync_failed", competitorId, error));
    return { score: scores.performance };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao medir o site.";
    await prisma.competitor.update({ where: { id: competitorId }, data: { websiteScoreError: message.slice(0, 500) } });
    throw new Error(message);
  }
}

/** Mesmas opções de `syncAllGooglePlaces`: directOnly pula referências, staleBefore é o fallback mensal, clientId é o botão "atualizar todos". */
export async function syncAllCompetitorWebsites(budgetMs = 50_000, options: { clientId?: string; directOnly?: boolean; staleBefore?: Date } = {}) {
  const started = Date.now();
  const profiles = await prisma.competitor.findMany({
    where: {
      ...(options.clientId ? { clientId: options.clientId } : {}),
      AND: [
        { OR: [{ website: { not: null } }, { websiteOverride: { not: null } }] },
        options.directOnly ? { OR: [{ isOwn: true }, { category: "DIRECT" as const }] } : {},
        options.staleBefore ? { OR: [{ websiteScoreAt: null }, { websiteScoreAt: { lt: options.staleBefore } }] } : {},
      ],
    },
    orderBy: { websiteScoreAt: { sort: "asc", nulls: "first" } },
    select: { id: true },
  });
  let ok = 0;
  let failed = 0;
  for (const profile of profiles) {
    if (Date.now() - started > budgetMs) break;
    await syncCompetitorWebsite(profile.id).then(() => ok++, () => failed++);
  }
  return { total: profiles.length, processed: ok + failed, ok, failed };
}
