import { prisma, type Prisma } from "@zenite-mkt/db";
import { META_CAMPAIGN_CHANNEL } from "@/lib/meta-campaign-sync";
import { cplCents, ctr, frequency, sumLevel, type LevelTotals } from "@/lib/xray-metrics";
import { raiseSystemAlert, resolveSystemAlert } from "@/lib/system-alerts";

/**
 * Tráfego - Raio X, fase 3: recomendações diárias. Olha os últimos 7 dias (e os 7 anteriores,
 * para cansaço de criativo) e sugere ações. Nada é aplicado sozinho: a equipe aplica ou ignora.
 */
export interface RecommendationRules {
  /** Pausar anúncio que gastou N × o custo por lead máximo sem nenhum lead. */
  noLeadSpendMultiplier: number;
  /** Mínimo de leads para julgar custo por lead acima do máximo. */
  minLeadsToJudgeBad: number;
  /** Mínimo de leads para sugerir aumento de verba quando o custo por lead está bom. */
  minLeadsToScale: number;
  /** Frequência a partir da qual o público pode estar cansado. */
  fatigueFrequency: number;
  /** Queda da taxa de cliques (%) frente à semana anterior para considerar cansaço. */
  fatigueCtrDropPct: number;
}

export const DEFAULT_RULES: RecommendationRules = { noLeadSpendMultiplier: 2, minLeadsToJudgeBad: 3, minLeadsToScale: 5, fatigueFrequency: 3, fatigueCtrDropPct: 30 };

export function parseRules(value: unknown): RecommendationRules {
  const v = (value ?? {}) as Partial<RecommendationRules>;
  const n = (x: unknown, min: number, max: number, fallback: number) => {
    const num = Number(x);
    return Number.isFinite(num) ? Math.min(max, Math.max(min, num)) : fallback;
  };
  return {
    noLeadSpendMultiplier: n(v.noLeadSpendMultiplier, 1, 10, DEFAULT_RULES.noLeadSpendMultiplier),
    minLeadsToJudgeBad: n(v.minLeadsToJudgeBad, 1, 100, DEFAULT_RULES.minLeadsToJudgeBad),
    minLeadsToScale: n(v.minLeadsToScale, 1, 100, DEFAULT_RULES.minLeadsToScale),
    fatigueFrequency: n(v.fatigueFrequency, 1, 20, DEFAULT_RULES.fatigueFrequency),
    fatigueCtrDropPct: n(v.fatigueCtrDropPct, 5, 90, DEFAULT_RULES.fatigueCtrDropPct),
  };
}

export const RECOMMENDATION_ALERT_KEY = "traffic:rec:summary";
const IGNORE_COOLDOWN_DAYS = 7;
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

interface Draft {
  type: "PAUSE" | "DECREASE_BUDGET" | "INCREASE_BUDGET" | "CREATIVE_FATIGUE" | "REJECTED";
  level: "campaign" | "adset" | "ad";
  targetId: string;
  targetName: string;
  campaignName: string;
  reason: string;
  metrics: LevelTotals & { cplCents: number | null; ctr: number | null; frequency: number | null };
  suggestedBudgetCents?: number | null;
}

const snapshot = (t: LevelTotals) => ({ ...t, cplCents: cplCents(t), ctr: ctr(t), frequency: frequency(t) });

/** Gera as recomendações do dia para a agência (chamado depois da sincronização com a Meta). */
export async function generateTrafficRecommendations(agencyId: string): Promise<{ pending: number; created: number }> {
  const settings = await prisma.trafficSettings.findUnique({ where: { agencyId } });
  const good = settings?.cplGoodCents ?? null;
  const max = settings?.cplMaxCents ?? null;
  const rules = parseRules(settings?.recommendationRules);
  const pct = settings?.maxBudgetChangePct ?? 20;

  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7);
  since.setUTCHours(0, 0, 0, 0);
  const prevSince = new Date(since);
  prevSince.setUTCDate(prevSince.getUTCDate() - 7);

  const campaigns = await prisma.campaign.findMany({
    where: { agencyId, channel: META_CAMPAIGN_CHANNEL, status: "ATIVA", externalId: { not: null } },
    select: {
      id: true,
      name: true,
      budgetCents: true,
      dailyMetrics: { where: { date: { gte: since } } },
      adSets: {
        where: { externalId: { not: null } },
        select: {
          id: true,
          name: true,
          budgetCents: true,
          metaStatus: true,
          dailyMetrics: { where: { date: { gte: since } } },
          ads: { where: { externalId: { not: null } }, select: { id: true, name: true, metaStatus: true, reviewFeedback: true, dailyMetrics: { where: { date: { gte: prevSince } } } } },
        },
      },
    },
  });

  // Teto: verba diária ativa (campanhas Advantage+ + conjuntos ligados das outras).
  const activeBudget = campaigns.reduce((n, c) => n + (c.budgetCents ?? c.adSets.filter((a) => a.metaStatus === "ACTIVE").reduce((m, a) => m + (a.budgetCents ?? 0), 0)), 0);
  const cap = settings?.dailyBudgetCapCents ?? null;

  const drafts: Draft[] = [];
  const scale = (level: "campaign" | "adset", id: string, name: string, campaignName: string, budget: number | null, t: LevelTotals) => {
    const cpl = cplCents(t);
    if (!budget || cpl === null) return;
    if (good && cpl <= good && t.leads >= rules.minLeadsToScale) {
      let next = Math.floor(budget * (1 + pct / 100));
      if (cap) next = Math.min(next, budget + Math.max(0, cap - activeBudget));
      if (next >= budget + 100) {
        drafts.push({ type: "INCREASE_BUDGET", level, targetId: id, targetName: name, campaignName, metrics: snapshot(t), suggestedBudgetCents: next, reason: `Custo por lead de ${brl(cpl)} (meta: bom até ${brl(good)}) com ${t.leads} leads em 7 dias. Aumentar a verba de ${brl(budget)} para ${brl(next)}/dia${cap && next < Math.floor(budget * (1 + pct / 100)) ? " (limitado pelo teto diário)" : ""}.` });
      }
    } else if (max && cpl > max && t.leads >= rules.minLeadsToJudgeBad) {
      const next = Math.max(600, Math.ceil(budget * (1 - pct / 100)));
      if (next < budget) drafts.push({ type: "DECREASE_BUDGET", level, targetId: id, targetName: name, campaignName, metrics: snapshot(t), suggestedBudgetCents: next, reason: `Custo por lead de ${brl(cpl)}, acima do máximo de ${brl(max)}, com ${t.leads} leads em 7 dias. Reduzir a verba de ${brl(budget)} para ${brl(next)}/dia enquanto ajusta criativos e público.` });
    }
  };

  for (const c of campaigns) {
    scale("campaign", c.id, c.name, c.name, c.budgetCents, sumLevel(c.dailyMetrics));
    for (const a of c.adSets) {
      if (!c.budgetCents && a.metaStatus === "ACTIVE") scale("adset", a.id, a.name, c.name, a.budgetCents, sumLevel(a.dailyMetrics));
      for (const ad of a.ads) {
        if (ad.metaStatus === "DISAPPROVED") {
          drafts.push({ type: "REJECTED", level: "ad", targetId: ad.id, targetName: ad.name, campaignName: c.name, metrics: snapshot(sumLevel([])), reason: `Anúncio reprovado pela Meta${ad.reviewFeedback ? `: ${ad.reviewFeedback}` : ""}. Corrija o criativo ou o texto e suba de novo pelo Gestor de tráfego.` });
          continue;
        }
        if (ad.metaStatus !== "ACTIVE") continue;
        const week = sumLevel(ad.dailyMetrics.filter((m) => m.date >= since));
        const prev = sumLevel(ad.dailyMetrics.filter((m) => m.date < since));
        const cpl = cplCents(week);
        if (max && week.leads === 0 && week.spendCents >= rules.noLeadSpendMultiplier * max) {
          drafts.push({ type: "PAUSE", level: "ad", targetId: ad.id, targetName: ad.name, campaignName: c.name, metrics: snapshot(week), reason: `Gastou ${brl(week.spendCents)} em 7 dias sem nenhum lead (${rules.noLeadSpendMultiplier}× o custo por lead máximo de ${brl(max)}). Pausar o anúncio.` });
        } else if (max && cpl !== null && cpl > max && week.leads >= rules.minLeadsToJudgeBad) {
          drafts.push({ type: "PAUSE", level: "ad", targetId: ad.id, targetName: ad.name, campaignName: c.name, metrics: snapshot(week), reason: `Custo por lead de ${brl(cpl)}, acima do máximo de ${brl(max)}, com ${week.leads} leads em 7 dias. Pausar o anúncio e deixar a verba para os melhores.` });
        }
        const f = frequency(week);
        const nowCtr = ctr(week);
        const prevCtr = ctr(prev);
        if (f !== null && f > rules.fatigueFrequency && nowCtr !== null && prevCtr && prev.impressions >= 500 && nowCtr <= prevCtr * (1 - rules.fatigueCtrDropPct / 100)) {
          drafts.push({ type: "CREATIVE_FATIGUE", level: "ad", targetId: ad.id, targetName: ad.name, campaignName: c.name, metrics: snapshot(week), reason: `Frequência ${f.toFixed(1)} e taxa de cliques caiu de ${(prevCtr * 100).toFixed(2)}% para ${(nowCtr * 100).toFixed(2)}% em relação à semana anterior: o público está cansando deste criativo. Suba uma variação nova.` });
        }
      }
    }
  }

  // Grava sem repetir: atualiza a pendente igual, pula as ignoradas há menos de 7 dias e expira as que não valem mais.
  const existing = await prisma.trafficRecommendation.findMany({ where: { agencyId, OR: [{ status: "PENDING" }, { status: "IGNORED", resolvedAt: { gte: new Date(now.getTime() - IGNORE_COOLDOWN_DAYS * 86_400_000) } }] } });
  const key = (r: { type: string; targetId: string }) => `${r.type}:${r.targetId}`;
  const byKey = new Map(existing.map((r) => [key(r), r]));
  const keep = new Set<string>();
  let created = 0;
  for (const d of drafts) {
    const k = key(d);
    keep.add(k);
    const found = byKey.get(k);
    const data = { targetName: d.targetName, campaignName: d.campaignName, reason: d.reason, metrics: d.metrics as unknown as Prisma.InputJsonValue, suggestedBudgetCents: d.suggestedBudgetCents ?? null, level: d.level };
    if (found?.status === "IGNORED") continue;
    if (found) await prisma.trafficRecommendation.update({ where: { id: found.id }, data });
    else {
      await prisma.trafficRecommendation.create({ data: { agencyId, type: d.type, targetId: d.targetId, ...data } });
      created += 1;
    }
  }
  const stale = existing.filter((r) => r.status === "PENDING" && !keep.has(key(r))).map((r) => r.id);
  if (stale.length) await prisma.trafficRecommendation.updateMany({ where: { id: { in: stale } }, data: { status: "EXPIRED", resolvedAt: now } });

  const pending = await prisma.trafficRecommendation.count({ where: { agencyId, status: "PENDING" } });
  if (pending > 0) {
    await raiseSystemAlert({ agencyId, key: RECOMMENDATION_ALERT_KEY, category: "AUTOMATION", severity: "INFO", title: `${pending} recomendação(ões) de tráfego para revisar`, detail: "Pausar anúncios caros, ajustar verba e trocar criativos cansados. Aplique ou ignore no Tráfego - Raio X.", href: "/trafego-raio-x" });
  } else {
    await resolveSystemAlert(agencyId, RECOMMENDATION_ALERT_KEY);
  }
  return { pending, created };
}
