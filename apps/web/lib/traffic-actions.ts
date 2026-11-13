import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { metaPost } from "@/lib/meta-marketing";
import { META_CAMPAIGN_CHANNEL } from "@/lib/meta-campaign-sync";

/**
 * Tráfego - Raio X, fase 2C: ativar, pausar e ajustar verba de campanha, conjunto ou anúncio da
 * Meta direto do portal, com as travas do Gestor de tráfego:
 * - botão de emergência ligado: só pausar (nada ativa nem aumenta verba);
 * - aumento de verba limitado à variação máxima por vez (reduzir é livre);
 * - a verba diária somada das campanhas/conjuntos ativos não passa do teto.
 * Toda mudança fica no histórico (audit_log, ações "traffic.*").
 */
export type TrafficLevel = "campaign" | "adset" | "ad";
export type TrafficAction = "pause" | "activate" | "budget";

export class TrafficActionError extends Error {}

interface Target {
  externalId: string;
  name: string;
  /** Verba diária atual (centavos), quando o nível tem verba. */
  budgetCents: number | null;
}

async function loadTarget(agencyId: string, level: TrafficLevel, id: string): Promise<Target> {
  if (level === "campaign") {
    const c = await prisma.campaign.findFirst({ where: { id, agencyId, channel: META_CAMPAIGN_CHANNEL }, select: { externalId: true, name: true, budgetCents: true } });
    if (!c?.externalId) throw new TrafficActionError("Campanha da Meta não encontrada.");
    return { externalId: c.externalId, name: c.name, budgetCents: c.budgetCents };
  }
  if (level === "adset") {
    const a = await prisma.adSet.findFirst({ where: { id, campaign: { agencyId } }, select: { externalId: true, name: true, budgetCents: true } });
    if (!a?.externalId) throw new TrafficActionError("Conjunto da Meta não encontrado.");
    return { externalId: a.externalId, name: a.name, budgetCents: a.budgetCents };
  }
  const ad = await prisma.ad.findFirst({ where: { id, adSet: { campaign: { agencyId } } }, select: { externalId: true, name: true } });
  if (!ad?.externalId) throw new TrafficActionError("Anúncio da Meta não encontrado.");
  return { externalId: ad.externalId, name: ad.name, budgetCents: null };
}

/** Verba diária ativa hoje na conta (campanhas Advantage+ ativas + conjuntos ativos das campanhas sem verba própria). */
async function activeDailyBudgetCents(agencyId: string, exclude: { level: TrafficLevel; id: string }): Promise<number> {
  const campaigns = await prisma.campaign.findMany({
    where: { agencyId, channel: META_CAMPAIGN_CHANNEL, status: "ATIVA" },
    select: { id: true, budgetCents: true, adSets: { where: { active: true }, select: { id: true, budgetCents: true } } },
  });
  let total = 0;
  for (const c of campaigns) {
    if (c.budgetCents) {
      if (!(exclude.level === "campaign" && exclude.id === c.id)) total += c.budgetCents;
    } else {
      for (const a of c.adSets) if (!(exclude.level === "adset" && exclude.id === a.id)) total += a.budgetCents ?? 0;
    }
  }
  return total;
}

export async function runTrafficAction(input: { agencyId: string; userId: string; level: TrafficLevel; id: string; action: TrafficAction; dailyBudgetCents?: number }): Promise<string> {
  const { agencyId, userId, level, id, action } = input;
  const [connection, settings] = await Promise.all([
    prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId, platform: "META" } }, select: { accessTokenEnc: true, status: true } }),
    prisma.trafficSettings.findUnique({ where: { agencyId } }),
  ]);
  if (!connection || connection.status !== "ACTIVE") throw new TrafficActionError("Conta de anúncios da Meta não conectada.");
  const target = await loadTarget(agencyId, level, id);
  const token = decryptSecret(connection.accessTokenEnc);
  const killSwitch = settings?.killSwitch === true;

  let params: Record<string, string | number>;
  let summary: string;
  const metadata: Record<string, unknown> = { level, name: target.name, externalId: target.externalId };

  if (action === "pause" || action === "activate") {
    if (action === "activate" && killSwitch) throw new TrafficActionError("Botão de emergência ligado em Configurações: só é possível pausar.");
    if (action === "activate" && settings?.dailyBudgetCapCents && target.budgetCents) {
      const others = await activeDailyBudgetCents(agencyId, { level, id });
      if (others + target.budgetCents > settings.dailyBudgetCapCents) {
        throw new TrafficActionError(`Ativar passaria do teto diário: R$ ${((others + target.budgetCents) / 100).toFixed(2)} de R$ ${(settings.dailyBudgetCapCents / 100).toFixed(2)}.`);
      }
    }
    params = { status: action === "pause" ? "PAUSED" : "ACTIVE" };
    summary = action === "pause" ? "pausou" : "ativou";
  } else {
    const next = Math.round(input.dailyBudgetCents ?? 0);
    if (level === "ad") throw new TrafficActionError("Anúncio não tem verba própria.");
    if (!target.budgetCents) throw new TrafficActionError(level === "campaign" ? "Esta campanha usa verba por conjunto: ajuste em cada conjunto." : "Este conjunto usa o orçamento da campanha: ajuste na campanha.");
    if (next < 600) throw new TrafficActionError("Verba diária mínima de R$ 6.");
    if (next > target.budgetCents) {
      if (killSwitch) throw new TrafficActionError("Botão de emergência ligado em Configurações: aumento de verba bloqueado.");
      const pct = settings?.maxBudgetChangePct ?? 20;
      const limit = Math.floor(target.budgetCents * (1 + pct / 100));
      if (next > limit) throw new TrafficActionError(`Aumento máximo por vez: ${pct}% (até R$ ${(limit / 100).toFixed(2)}/dia). Ajuste em Configurações se quiser outro limite.`);
      if (settings?.dailyBudgetCapCents) {
        const others = await activeDailyBudgetCents(agencyId, { level, id });
        if (others + next > settings.dailyBudgetCapCents) {
          throw new TrafficActionError(`Passaria do teto diário: R$ ${((others + next) / 100).toFixed(2)} de R$ ${(settings.dailyBudgetCapCents / 100).toFixed(2)}.`);
        }
      }
    }
    params = { daily_budget: next };
    metadata.fromCents = target.budgetCents;
    metadata.toCents = next;
    summary = `mudou a verba de R$ ${(target.budgetCents / 100).toFixed(2)} para R$ ${(next / 100).toFixed(2)}/dia`;
  }

  await metaPost(`/${target.externalId}`, token, params, `${summary} "${target.name}"`);

  // Reflete no portal sem esperar a próxima sincronização.
  if (action === "budget") {
    const budgetCents = params.daily_budget as number;
    if (level === "campaign") await prisma.campaign.update({ where: { id }, data: { budgetCents } });
    else await prisma.adSet.update({ where: { id }, data: { budgetCents } });
  } else {
    const active = action === "activate";
    if (level === "campaign") await prisma.campaign.update({ where: { id }, data: { status: active ? "ATIVA" : "PAUSADA" } });
    else if (level === "adset") await prisma.adSet.update({ where: { id }, data: { active, metaStatus: active ? "ACTIVE" : "PAUSED" } });
    else await prisma.ad.update({ where: { id }, data: { active, metaStatus: active ? "ACTIVE" : "PAUSED" } });
  }

  await prisma.auditLog.create({ data: { agencyId, actorUserId: userId, actorType: "user", action: `traffic.${action}`, resourceType: `meta_${level}`, resourceId: id, metadata: { ...metadata, summary } as object } });
  return summary;
}
