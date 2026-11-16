import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { raiseSystemAlert } from "@/lib/system-alerts";

const MAX_ADS_PER_BATCH = 500;

export interface CompetitorAdInput {
  adArchiveId: string;
  startedAt: Date | null;
  platforms: string[];
  bodyText: string | null;
  headline: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  creativeUrls: string[];
  format: string | null;
}

const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const httpsUrl = (value: unknown) => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
};

export function hashCompetitorAdsToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateCompetitorAdsToken(): string {
  return `zca_${randomBytes(32).toString("base64url")}`;
}

export function tokenMatchesCompetitorAdsHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCompetitorAdsToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseCompetitorAdsPayload(value: unknown): CompetitorAdInput[] {
  const raw = (value as { ads?: unknown } | null)?.ads;
  if (!Array.isArray(raw)) throw new Error("Envie o campo ads como uma lista.");
  if (raw.length > MAX_ADS_PER_BATCH) throw new Error(`O lote aceita no máximo ${MAX_ADS_PER_BATCH} anúncios.`);
  const unique = new Map<string, CompetitorAdInput>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const adArchiveId = text(source.adArchiveId, 200);
    if (!adArchiveId) continue;
    const started = typeof source.startedAt === "string" ? new Date(source.startedAt) : null;
    const startedAt = started && Number.isFinite(started.getTime()) && started.getTime() <= Date.now() + 86_400_000 ? started : null;
    const platforms = Array.isArray(source.platforms)
      ? Array.from(new Set(source.platforms.map((entry) => text(entry, 40)).filter((entry): entry is string => Boolean(entry)))).slice(0, 10)
      : [];
    const creativeUrls = Array.isArray(source.creativeUrls)
      ? Array.from(new Set(source.creativeUrls.map(httpsUrl).filter((entry): entry is string => Boolean(entry)))).slice(0, 20)
      : [];
    unique.set(adArchiveId, {
      adArchiveId,
      startedAt,
      platforms,
      bodyText: text(source.bodyText, 10_000),
      headline: text(source.headline, 500),
      linkUrl: httpsUrl(source.linkUrl),
      ctaLabel: text(source.ctaLabel, 200),
      creativeUrls,
      format: text(source.format, 40)?.toUpperCase() ?? null,
    });
  }
  return [...unique.values()];
}

export async function syncCompetitorAds(competitorId: string, agencyId: string, ads: CompetitorAdInput[]) {
  const competitor = await prisma.competitor.findFirst({ where: { id: competitorId, agencyId }, select: { id: true, igUsername: true } });
  if (!competitor) throw new Error("Concorrente não encontrado para esta agência.");
  const ids = ads.map((ad) => ad.adArchiveId);
  const existing = await prisma.competitorAd.findMany({ where: { competitorId, adArchiveId: { in: ids } }, select: { adArchiveId: true } });
  const known = new Set(existing.map((ad) => ad.adArchiveId));
  const deactivated = await prisma.competitorAd.count({ where: { competitorId, active: true, adArchiveId: { notIn: ids } } });
  const now = new Date();

  await prisma.$transaction([
    ...ads.map((ad) => prisma.competitorAd.upsert({
      where: { competitorId_adArchiveId: { competitorId, adArchiveId: ad.adArchiveId } },
      create: { competitorId, ...ad, active: true, lastSeenAt: now },
      update: { ...ad, active: true, lastSeenAt: now },
    })),
    prisma.competitorAd.updateMany({ where: { competitorId, active: true, adArchiveId: { notIn: ids } }, data: { active: false } }),
  ]);

  const created = ads.filter((ad) => !known.has(ad.adArchiveId));
  for (const ad of created) {
    await raiseSystemAlert({
      agencyId,
      key: `competitor:newad:${ad.adArchiveId}`,
      category: "AUTOMATION",
      severity: "INFO",
      title: `@${competitor.igUsername} publicou um novo anúncio`,
      detail: ad.headline ?? ad.bodyText?.slice(0, 300) ?? "Um anúncio novo apareceu na Biblioteca de Anúncios da Meta.",
      href: `/concorrentes?c=${competitor.id}`,
    });
  }
  return { received: ads.length, created: created.length, deactivated };
}

