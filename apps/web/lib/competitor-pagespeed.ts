import { prisma } from "@zenite-mkt/db";

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

export async function fetchPageSpeedScore(rawUrl: string): Promise<number> {
  const website = normalizeWebsiteUrl(rawUrl);
  if (!website) throw new Error("O endereço do site é inválido.");
  const url = new URL(ENDPOINT);
  url.searchParams.set("url", website);
  url.searchParams.set("strategy", "mobile");
  url.searchParams.set("category", "performance");
  url.searchParams.set("locale", "pt_BR");
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY?.trim();
  if (apiKey) url.searchParams.set("key", apiKey);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
  const body = await response.json().catch(() => null) as { lighthouseResult?: { categories?: { performance?: { score?: number | null } } }; error?: { message?: string } } | null;
  if (!response.ok) {
    const detail = body?.error?.message ?? `erro ${response.status}`;
    if (response.status === 429 || /quota exceeded/i.test(detail)) throw new Error("Limite diário do PageSpeed atingido. Tente novamente amanhã ou configure GOOGLE_PAGESPEED_API_KEY.");
    throw new Error(`PageSpeed: ${detail}`);
  }
  const score = body?.lighthouseResult?.categories?.performance?.score;
  if (typeof score !== "number") throw new Error("O PageSpeed não devolveu uma nota de performance.");
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
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
    const score = await fetchPageSpeedScore(website);
    await prisma.competitor.update({ where: { id: competitorId }, data: { websiteScore: score, websiteScoreAt: new Date(), websiteScoreError: null } });
    return { score };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao medir o site.";
    await prisma.competitor.update({ where: { id: competitorId }, data: { websiteScoreError: message.slice(0, 500) } });
    throw new Error(message);
  }
}

export async function syncAllCompetitorWebsites(budgetMs = 50_000) {
  const started = Date.now();
  const profiles = await prisma.competitor.findMany({ where: { OR: [{ website: { not: null } }, { websiteOverride: { not: null } }] }, orderBy: { websiteScoreAt: { sort: "asc", nulls: "first" } }, select: { id: true } });
  let ok = 0;
  let failed = 0;
  for (const profile of profiles) {
    if (Date.now() - started > budgetMs) break;
    await syncCompetitorWebsite(profile.id).then(() => ok++, () => failed++);
  }
  return { total: profiles.length, processed: ok + failed, ok, failed };
}
