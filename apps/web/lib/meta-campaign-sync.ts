import { prisma, type AdCreativeStatus, type CampaignStatus, type Prisma } from "@zenite-mkt/db";
import { setCreativeStatus } from "@/lib/ad-creatives";
import { decryptSecret } from "@/lib/crypto-secrets";
import {
  campaignStatusFromMeta,
  fetchMetaCampaignById,
  fetchMetaCampaignInsights,
  fetchMetaCampaigns,
  fetchMetaAdSets,
  fetchMetaAds,
  fetchMetaCityCoordinates,
  fetchMetaLevelInsights,
  type MetaCampaignInfo,
} from "@/lib/meta-ads";

export const META_CAMPAIGN_CHANNEL = "Meta Ads";
/** Depois disto sem sincronizar, as telas de campanha atualizam sozinhas ao abrir. */
export const META_SYNC_STALE_MS = 30 * 60_000;
/** Primeira sincronização (e uma vez por mês) busca 90 dias; as outras refazem só 7 (a Meta corrige dias anteriores). */
const FULL_PERIOD_DAYS = 90;
const INCREMENTAL_PERIOD_DAYS = 7;
const FULL_SYNC_EVERY_MS = 30 * 24 * 60 * 60_000;
const FULL_SYNC_AFTER = new Date("2026-11-13T19:15:00Z");

export interface MetaCampaignSyncResult {
  campaignsCreated: number;
  /** Campanhas já existentes cujo status ou nome mudou na Meta. */
  campaignsUpdated: number;
  metricsUpserted: number;
  periodDays: number;
  /** Conta de anúncios consultada e quantas campanhas a Meta devolveu nela (para o aviso na tela). */
  accountId: string;
  accountName: string | null;
  campaignsFound: number;
  adSetsSynced?: number;
  adsSynced?: number;
  /** Falha só nos níveis de conjunto/anúncio (as campanhas sincronizaram). */
  levelsError?: string | null;
}

export class MetaSyncError extends Error {}

export function isMetaSyncStale(lastValidatedAt: Date | null, now = new Date()): boolean {
  return !lastValidatedAt || now.getTime() - lastValidatedAt.getTime() > META_SYNC_STALE_MS;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "Atualizar da Meta": traz da conta conectada o nome e a situação real de
 * cada campanha (ativa, pausada, encerrada) e as métricas diárias dos
 * últimos 30 dias, casando por `Campaign.externalId`.
 *
 * - Toda campanha da conta entra, em qualquer situação (ativa, pausada,
 *   arquivada), para a lista bater com o Gerenciador.
 * - Arquivada/excluída não vem na lista da conta: as que já temos são
 *   consultadas uma a uma pelo ID.
 * - O que a Meta não devolve (ex.: campanha de outra conta) não é alterado.
 */
export async function syncMetaCampaigns(agencyId: string): Promise<MetaCampaignSyncResult> {
  const connection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId, platform: "META" } },
  });
  if (!connection || connection.status !== "ACTIVE") {
    throw new MetaSyncError("Conecte a conta da Meta antes de sincronizar campanhas.");
  }

  const now = new Date();
  // FULL_SYNC_AFTER: busca completa refeita depois da correção dos conjuntos de campanha pausada.
  const full = !connection.metaFullSyncAt || connection.metaFullSyncAt < FULL_SYNC_AFTER || now.getTime() - connection.metaFullSyncAt.getTime() > FULL_SYNC_EVERY_MS;
  const PERIOD_DAYS = full ? FULL_PERIOD_DAYS : INCREMENTAL_PERIOD_DAYS;
  const since = new Date(now.getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000);

  let listed: MetaCampaignInfo[];
  let rows;
  const infoById = new Map<string, MetaCampaignInfo>();
  const known = await prisma.campaign.findMany({
    where: { agencyId, externalId: { not: null } },
    select: { id: true, externalId: true, name: true, status: true, channel: true, clientId: true },
  });
  try {
    const accessToken = decryptSecret(connection.accessTokenEnc);
    [listed, rows] = await Promise.all([
      fetchMetaCampaigns(accessToken, connection.externalAccountId),
      fetchMetaCampaignInsights(accessToken, connection.externalAccountId, formatDate(since), formatDate(now)),
    ]);
    for (const info of listed) infoById.set(info.id, info);

    // Fora da lista (arquivada, excluída): confere pelo ID as que já temos ou que tiveram entrega.
    const missing = new Set<string>();
    for (const row of rows) if (!infoById.has(row.campaignId)) missing.add(row.campaignId);
    for (const c of known) {
      if (c.channel === META_CAMPAIGN_CHANNEL && c.externalId && !infoById.has(c.externalId)) missing.add(c.externalId);
    }
    for (const id of missing) {
      const info = await fetchMetaCampaignById(accessToken, id);
      if (info) infoById.set(info.id, info);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.adAccountConnection.update({ where: { id: connection.id }, data: { lastError: message } });
    throw new MetaSyncError(`Falha ao buscar dados da Meta: ${message}`);
  }

  const knownByExternalId = new Map(known.map((c) => [c.externalId as string, c]));
  const campaignIdByExternalId = new Map<string, string>(known.map((c) => [c.externalId as string, c.id]));
  const nameFromInsights = new Map(rows.map((row) => [row.campaignId, row.campaignName]));
  // Campanha nova herda o cliente das campanhas da Meta já ligadas a um cliente, se todas forem do mesmo (a conta é de um cliente só).
  const metaClientIds = new Set(known.filter((c) => c.channel === META_CAMPAIGN_CHANNEL && c.clientId).map((c) => c.clientId as string));
  const inheritedClientId = metaClientIds.size === 1 ? [...metaClientIds][0]! : null;
  let campaignsCreated = 0;
  let campaignsUpdated = 0;

  // Excluída ou arquivada na Meta e que nunca gastou nada (teste): não entra e, se já estava, sai do portal.
  const spentInPeriod = new Set(rows.filter((row) => row.spendCents > 0).map((row) => row.campaignId));
  const removable = new Set<string>();
  for (const [externalId, info] of infoById) {
    const s = info.effectiveStatus.toUpperCase();
    if ((s === "ARCHIVED" || s === "DELETED") && !spentInPeriod.has(externalId)) removable.add(externalId);
  }
  if (removable.size) {
    const candidates = await prisma.campaign.findMany({
      where: { agencyId, channel: META_CAMPAIGN_CHANNEL, externalId: { in: Array.from(removable) } },
      select: { id: true, externalId: true, dailyMetrics: { where: { spendCents: { gt: 0 } }, select: { id: true }, take: 1 } },
    });
    for (const c of candidates) if (c.dailyMetrics.length) removable.delete(c.externalId as string);
    const ids = Array.from(removable);
    await prisma.$transaction([
      prisma.campaign.deleteMany({ where: { agencyId, channel: META_CAMPAIGN_CHANNEL, externalId: { in: ids } } }),
      prisma.trafficCampaign.deleteMany({ where: { agencyId, metaCampaignId: { in: ids } } }),
    ]);
    for (const id of ids) {
      knownByExternalId.delete(id);
      campaignIdByExternalId.delete(id);
    }
  }

  for (const externalId of new Set([...infoById.keys(), ...nameFromInsights.keys()])) {
    if (removable.has(externalId)) continue;
    const info = infoById.get(externalId);
    const status: CampaignStatus | null = info ? campaignStatusFromMeta(info.effectiveStatus, info.stopTime, now) : null;
    const name = info?.name || nameFromInsights.get(externalId) || "Campanha da Meta";
    const dates = info ? { startDate: parseDate(info.startTime), endDate: parseDate(info.stopTime), budgetCents: info.dailyBudgetCents } : {};
    const existing = knownByExternalId.get(externalId);

    if (existing) {
      const changed = existing.name !== name || (status !== null && existing.status !== status);
      await prisma.campaign.update({
        where: { id: existing.id },
        data: { name, ...(status ? { status } : {}), ...dates },
      });
      if (changed) campaignsUpdated += 1;
      continue;
    }

    const created = await prisma.campaign.create({
      data: { agencyId, clientId: inheritedClientId, name, channel: META_CAMPAIGN_CHANNEL, externalId, ...(status ? { status } : {}), ...dates },
    });
    campaignIdByExternalId.set(externalId, created.id);
    campaignsCreated += 1;
  }

  let metricsUpserted = 0;
  for (const row of rows) {
    const campaignId = campaignIdByExternalId.get(row.campaignId);
    if (!campaignId) continue;
    const metrics = {
      spendCents: row.spendCents,
      impressions: row.impressions,
      clicks: row.clicks,
      reach: row.reach,
      results: row.results,
      resultValueCents: row.resultValueCents,
    };
    await prisma.campaignDailyMetric.upsert({
      where: { campaignId_date: { campaignId, date: new Date(row.date) } },
      create: { campaignId, date: new Date(row.date), ...metrics },
      update: metrics,
    });
    metricsUpserted += 1;
  }

  // Conjuntos, anúncios, números por nível, mapa e situação dos criativos do Gestor de tráfego.
  let levels: { adSets: number; ads: number } = { adSets: 0, ads: 0 };
  let levelsError: string | null = null;
  try {
    levels = await syncMetaLevels(agencyId, decryptSecret(connection.accessTokenEnc), connection.externalAccountId, campaignIdByExternalId, formatDate(since), formatDate(now));
  } catch (error) {
    levelsError = error instanceof Error ? error.message : "Erro desconhecido.";
    console.error("meta_levels_sync_failed", levelsError);
  }

  await prisma.adAccountConnection.update({
    where: { id: connection.id },
    data: { lastValidatedAt: new Date(), lastError: levelsError ? `Conjuntos/anúncios: ${levelsError}` : null, ...(full && !levelsError ? { metaFullSyncAt: now } : {}) },
  });

  return {
    adSetsSynced: levels.adSets,
    adsSynced: levels.ads,
    levelsError,
    campaignsCreated,
    campaignsUpdated,
    metricsUpserted,
    periodDays: PERIOD_DAYS,
    accountId: connection.externalAccountId,
    accountName: connection.externalAccountName,
    campaignsFound: infoById.size,
  };
}


/** Situação do anúncio na Meta → situação do criativo na biblioteca (e pasta no Drive). */
function creativeStatusFromAd(effectiveStatus: string): AdCreativeStatus | null {
  switch (effectiveStatus) {
    case "PENDING_REVIEW":
    case "IN_PROCESS":
    case "PREAPPROVED":
      return "IN_REVIEW";
    case "ACTIVE":
      return "ACTIVE";
    case "DISAPPROVED":
      return "REJECTED";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
    case "ARCHIVED":
      return "PAUSED";
    default:
      return null;
  }
}

/** Grava em lotes (uma ida ao banco a cada 100 linhas): 90 dias × anúncios passa de mil linhas. */
async function upsertDaily<T extends { date: string }>(rows: T[], idFor: (row: T) => string | undefined, write: (id: string, date: Date, row: T) => Prisma.PrismaPromise<unknown>) {
  const ops = rows.flatMap((row) => {
    const id = idFor(row);
    return id ? [write(id, new Date(row.date), row)] : [];
  });
  for (let i = 0; i < ops.length; i += 100) await prisma.$transaction(ops.slice(i, i + 100));
}

/**
 * Conjuntos e anúncios da conta (estrutura, situação, verba, miniatura, motivo de reprovação),
 * números diários por conjunto e por anúncio, cidades da segmentação no mapa e situação dos
 * criativos subidos pelo Gestor de tráfego.
 */
async function syncMetaLevels(agencyId: string, token: string, adAccountId: string, campaignIdByExternalId: Map<string, string>, since: string, until: string) {
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const [adSets, ads, adSetRows, adRows] = await Promise.all([
    fetchMetaAdSets(token, act),
    fetchMetaAds(token, act),
    fetchMetaLevelInsights(token, act, "adset", since, until),
    fetchMetaLevelInsights(token, act, "ad", since, until),
  ]);

  // Conjuntos.
  const campaignIds = Array.from(new Set(campaignIdByExternalId.values()));
  const existingSets = await prisma.adSet.findMany({ where: { campaignId: { in: campaignIds }, externalId: { not: null } }, select: { id: true, externalId: true } });
  const adSetIdByExternal = new Map(existingSets.map((a) => [a.externalId as string, a.id]));
  for (const info of adSets) {
    const campaignId = campaignIdByExternalId.get(info.campaignId);
    if (!campaignId) continue;
    const data = { name: info.name, metaStatus: info.effectiveStatus, active: info.effectiveStatus === "ACTIVE", budgetCents: info.dailyBudgetCents, targetingSummary: info.targetingSummary || null };
    const id = adSetIdByExternal.get(info.id);
    if (id) await prisma.adSet.update({ where: { id }, data: { ...data, campaignId } });
    else adSetIdByExternal.set(info.id, (await prisma.adSet.create({ data: { ...data, campaignId, externalId: info.id } })).id);
  }

  // Anúncios.
  const existingAds = await prisma.ad.findMany({ where: { adSet: { campaignId: { in: campaignIds } }, externalId: { not: null } }, select: { id: true, externalId: true } });
  const adIdByExternal = new Map(existingAds.map((a) => [a.externalId as string, a.id]));
  for (const info of ads) {
    const adSetId = adSetIdByExternal.get(info.adSetId);
    if (!adSetId) continue;
    const data = { name: info.name, metaStatus: info.effectiveStatus, active: info.effectiveStatus === "ACTIVE", reviewFeedback: info.reviewFeedback, thumbnailUrl: info.thumbnailUrl };
    const id = adIdByExternal.get(info.id);
    if (id) await prisma.ad.update({ where: { id }, data: { ...data, adSetId } });
    else adIdByExternal.set(info.id, (await prisma.ad.create({ data: { ...data, adSetId, externalId: info.id } })).id);
  }

  // Números diários por conjunto e por anúncio.
  const metric = (row: { spendCents: number; impressions: number; reach: number; clicks: number; linkClicks: number; leads: number }) => ({
    spendCents: row.spendCents,
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    linkClicks: row.linkClicks,
    leads: row.leads,
  });
  await upsertDaily(adSetRows, (r) => adSetIdByExternal.get(r.id), (adSetId, date, r) =>
    prisma.adSetDailyMetric.upsert({ where: { adSetId_date: { adSetId, date } }, create: { adSetId, date, ...metric(r) }, update: metric(r) }),
  );
  await upsertDaily(adRows, (r) => adIdByExternal.get(r.id), (adId, date, r) =>
    prisma.adDailyMetric.upsert({ where: { adId_date: { adId, date } }, create: { adId, date, ...metric(r) }, update: metric(r) }),
  );

  // Mapa: cidades (e raio) da segmentação de cada campanha. As cadastradas à mão ficam.
  const citiesByCampaign = new Map<string, Map<string, { name: string; radiusKm: number | null }>>();
  for (const info of adSets) {
    const campaignId = campaignIdByExternalId.get(info.campaignId);
    if (!campaignId || info.effectiveStatus === "ARCHIVED" || info.effectiveStatus === "DELETED") continue;
    const map = citiesByCampaign.get(campaignId) ?? new Map();
    for (const c of info.cities) {
      const prev = map.get(c.key);
      map.set(c.key, { name: c.name, radiusKm: Math.max(prev?.radiusKm ?? 0, c.radiusKm ?? 0) || null });
    }
    citiesByCampaign.set(campaignId, map);
  }
  const cityKeys = Array.from(new Set(Array.from(citiesByCampaign.values()).flatMap((m) => Array.from(m.keys()).filter((k) => !k.startsWith("pin:")))));
  const cityNames = new Map<string, string>();
  for (const m of citiesByCampaign.values()) for (const [k, c] of m) if (!k.startsWith("pin:")) cityNames.set(k, c.name);
  const coords = await resolveCityCoordinates(agencyId, token, cityKeys, cityNames);
  // Pinos (endereço/coordenada) já trazem latitude e longitude.
  const pinCoords = new Map<string, { lat: number; lng: number }>();
  for (const info of adSets) {
    const campaignId = campaignIdByExternalId.get(info.campaignId);
    if (!campaignId || info.effectiveStatus === "ARCHIVED" || info.effectiveStatus === "DELETED") continue;
    const map = citiesByCampaign.get(campaignId) ?? new Map();
    for (const p of info.pins) {
      pinCoords.set(p.key, { lat: p.lat, lng: p.lng });
      const prev = map.get(p.key);
      map.set(p.key, { name: p.name, radiusKm: Math.max(prev?.radiusKm ?? 0, p.radiusKm ?? 0) || null });
    }
    citiesByCampaign.set(campaignId, map);
  }
  const where = (key: string) => coords.get(key) ?? pinCoords.get(key);
  for (const [campaignId, cities] of citiesByCampaign) {
    const rows = Array.from(cities.entries()).filter(([key]) => where(key));
    if (!rows.length) continue;
    await prisma.$transaction([
      prisma.campaignGeoTarget.deleteMany({ where: { campaignId, externalKey: { not: null } } }),
      prisma.campaignGeoTarget.createMany({ data: rows.map(([key, c]) => ({ campaignId, externalKey: key, label: c.name, lat: where(key)!.lat, lng: where(key)!.lng, radiusKm: c.radiusKm })) }),
    ]);
  }

  // Criativos do Gestor de tráfego: situação vinda da Meta (move o arquivo de pasta no Drive e alerta se reprovar).
  const adInfoById = new Map(ads.map((a) => [a.id, a]));
  const creatives = await prisma.adCreative.findMany({ where: { agencyId, metaAdId: { in: Array.from(adInfoById.keys()) } }, select: { id: true, status: true, metaAdId: true } });
  for (const creative of creatives) {
    const info = adInfoById.get(creative.metaAdId as string);
    const status = info ? creativeStatusFromAd(info.effectiveStatus) : null;
    if (status && status !== creative.status) {
      await setCreativeStatus(creative.id, status, status === "REJECTED" ? info?.reviewFeedback ?? "Reprovado pela Meta." : null).catch((error) => console.error("creative_status_sync_failed", creative.id, error));
    }
  }

  return { adSets: adSets.length, ads: ads.length };
}


/**
 * Coordenadas das cidades da segmentação: primeiro as já guardadas (mapa de outra campanha),
 * depois a busca de localização da Meta e, para o que faltar, o OpenStreetMap (só o nome da
 * cidade; até 10 por sincronização, 1 por segundo, como pede a política de uso deles).
 */
async function resolveCityCoordinates(agencyId: string, token: string, keys: string[], names: Map<string, string>) {
  const out = new Map<string, { lat: number; lng: number }>();
  if (!keys.length) return out;
  const saved = await prisma.campaignGeoTarget.findMany({ where: { externalKey: { in: keys }, campaign: { agencyId } }, select: { externalKey: true, lat: true, lng: true } });
  for (const g of saved) if (g.externalKey) out.set(g.externalKey, { lat: g.lat, lng: g.lng });
  let missing = keys.filter((k) => !out.has(k));
  if (missing.length) {
    const meta = await fetchMetaCityCoordinates(token, missing);
    for (const [k, v] of meta) out.set(k, v);
    missing = missing.filter((k) => !out.has(k));
  }
  for (const key of missing.slice(0, 10)) {
    const name = names.get(key);
    if (!name) continue;
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", `${name}, Brasil`);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "br");
      const res = await fetch(url, { headers: { "User-Agent": "traffic-map-sync/1.0", "Accept-Language": "pt-BR" }, cache: "no-store" });
      const data = (await res.json().catch(() => [])) as { lat?: string; lon?: string }[];
      const first = data[0];
      if (first?.lat && first?.lon) out.set(key, { lat: Number(first.lat), lng: Number(first.lon) });
    } catch (error) {
      console.warn("city_geocode_failed", name, error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return out;
}
