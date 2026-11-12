import { prisma, type CampaignStatus } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import {
  campaignStatusFromMeta,
  fetchMetaCampaignById,
  fetchMetaCampaignInsights,
  fetchMetaCampaigns,
  type MetaCampaignInfo,
} from "@/lib/meta-ads";

export const META_CAMPAIGN_CHANNEL = "Meta Ads";
/** Depois disto sem sincronizar, as telas de campanha atualizam sozinhas ao abrir. */
export const META_SYNC_STALE_MS = 30 * 60_000;
const PERIOD_DAYS = 30;

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

  for (const externalId of new Set([...infoById.keys(), ...nameFromInsights.keys()])) {
    const info = infoById.get(externalId);
    const status: CampaignStatus | null = info ? campaignStatusFromMeta(info.effectiveStatus, info.stopTime, now) : null;
    const name = info?.name || nameFromInsights.get(externalId) || "Campanha da Meta";
    const dates = info ? { startDate: parseDate(info.startTime), endDate: parseDate(info.stopTime) } : {};
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

  await prisma.adAccountConnection.update({
    where: { id: connection.id },
    data: { lastValidatedAt: new Date(), lastError: null },
  });

  return {
    campaignsCreated,
    campaignsUpdated,
    metricsUpserted,
    periodDays: PERIOD_DAYS,
    accountId: connection.externalAccountId,
    accountName: connection.externalAccountName,
    campaignsFound: infoById.size,
  };
}
