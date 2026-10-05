import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { decryptSecret } from "@/lib/crypto-secrets";
import { fetchMetaCampaignInsights } from "@/lib/meta-ads";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Etapa 5 do plano de Traqueamento (seção 3/36/38) — puxa campanha+métrica
 * diária reais da Meta e faz upsert em `Campaign`/`CampaignDailyMetric`
 * (casando por `externalId`), trocando o preenchimento manual por dado
 * automático pras campanhas que já existem na conta conectada. Campanhas sem
 * conexão (ex.: Google Ads) continuam só manuais, sem mudança nenhuma.
 */
export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const connection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } },
  });
  if (!connection || connection.status !== "ACTIVE") {
    return NextResponse.json({ error: "Conecte a conta da Meta antes de sincronizar campanhas." }, { status: 400 });
  }

  const until = new Date();
  const since = new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000);

  let rows;
  try {
    const accessToken = decryptSecret(connection.accessTokenEnc);
    rows = await fetchMetaCampaignInsights(accessToken, connection.externalAccountId, formatDate(since), formatDate(until));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.adAccountConnection.update({ where: { id: connection.id }, data: { lastError: message } });
    return NextResponse.json({ error: `Falha ao buscar dados da Meta: ${message}` }, { status: 502 });
  }

  const campaignIdByExternalId = new Map<string, string>();
  let campaignsCreated = 0;
  let metricsUpserted = 0;

  for (const row of rows) {
    let campaignId = campaignIdByExternalId.get(row.campaignId);
    if (!campaignId) {
      const existing = await prisma.campaign.findFirst({
        where: { agencyId: membership.agencyId, externalId: row.campaignId },
      });
      if (existing) {
        campaignId = existing.id;
      } else {
        const created = await prisma.campaign.create({
          data: {
            agencyId: membership.agencyId,
            name: row.campaignName,
            channel: "Meta Ads",
            externalId: row.campaignId,
          },
        });
        campaignId = created.id;
        campaignsCreated += 1;
      }
      campaignIdByExternalId.set(row.campaignId, campaignId);
    }

    await prisma.campaignDailyMetric.upsert({
      where: { campaignId_date: { campaignId, date: new Date(row.date) } },
      create: {
        campaignId,
        date: new Date(row.date),
        spendCents: row.spendCents,
        impressions: row.impressions,
        clicks: row.clicks,
        reach: row.reach,
        results: row.results,
        resultValueCents: row.resultValueCents,
      },
      update: {
        spendCents: row.spendCents,
        impressions: row.impressions,
        clicks: row.clicks,
        reach: row.reach,
        results: row.results,
        resultValueCents: row.resultValueCents,
      },
    });
    metricsUpserted += 1;
  }

  await prisma.adAccountConnection.update({
    where: { id: connection.id },
    data: { lastValidatedAt: new Date(), lastError: null },
  });

  return NextResponse.json({ ok: true, campaignsCreated, metricsUpserted, periodDays: 30 });
}
