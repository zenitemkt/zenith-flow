import { prisma } from "@zenite-mkt/db";
import { engagementOf, formatOf } from "@/lib/competitor-analytics";
import { raiseSystemAlert, resolveSystemAlertsByPrefix } from "@/lib/system-alerts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CompetitorAlertPost {
  id: string;
  timestamp: Date;
  mediaType: string;
  mediaProductType: string | null;
  likeCount: number | null;
  commentsCount: number | null;
}

export interface CompetitorAlertSnapshot {
  day: Date;
  followers: number | null;
}

export interface CompetitorAlertInput {
  id: string;
  username: string;
  posts: CompetitorAlertPost[];
  snapshots: CompetitorAlertSnapshot[];
}

export interface CompetitorAlertCandidate {
  key: string;
  title: string;
  detail: string;
  href: string;
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function ratioLabel(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function formatKey(post: CompetitorAlertPost): string {
  return formatOf(post).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Regras puras da Fase 2A, separadas do banco para manter os limiares testáveis. */
export function detectCompetitorAlerts(competitor: CompetitorAlertInput, now = new Date()): CompetitorAlertCandidate[] {
  const alerts: CompetitorAlertCandidate[] = [];
  const href = `/concorrentes?c=${encodeURIComponent(competitor.id)}`;
  const username = `@${competitor.username}`;
  const since90Days = new Date(now.getTime() - 90 * DAY_MS);
  const since2Days = new Date(now.getTime() - 2 * DAY_MS);
  const posts90Days = competitor.posts.filter((post) => post.timestamp >= since90Days && post.timestamp <= now);

  if (posts90Days.length >= 10) {
    const average = posts90Days.reduce((total, post) => total + engagementOf(post), 0) / posts90Days.length;
    if (average > 0) {
      for (const post of posts90Days.filter((item) => item.timestamp >= since2Days)) {
        const engagement = engagementOf(post);
        if (engagement >= average * 3) {
          alerts.push({
            key: `competitor:viral:${post.id}`,
            title: `${username} publicou acima da média`,
            detail: `O post teve ${engagement} interações, ${ratioLabel(engagement / average)}x a média dos últimos 90 dias (${posts90Days.length} posts).`,
            href,
          });
        }
      }
    }
  }

  const snapshots = competitor.snapshots
    .filter((snapshot): snapshot is CompetitorAlertSnapshot & { followers: number } => snapshot.followers !== null && snapshot.day <= now)
    .sort((a, b) => a.day.getTime() - b.day.getTime());
  if (snapshots.length >= 3) {
    const latest = snapshots.at(-1)!;
    const previous = snapshots.at(-2)!;
    const latestDays = Math.max(1, Math.round((latest.day.getTime() - previous.day.getTime()) / DAY_MS));
    const latestDailyGrowth = (latest.followers - previous.followers) / latestDays;
    const historyStart = latest.day.getTime() - 30 * DAY_MS;
    const historicalRates: number[] = [];
    for (let index = 1; index < snapshots.length - 1; index += 1) {
      const current = snapshots[index]!;
      const prior = snapshots[index - 1]!;
      if (current.day.getTime() < historyStart) continue;
      const elapsedDays = Math.max(1, Math.round((current.day.getTime() - prior.day.getTime()) / DAY_MS));
      historicalRates.push((current.followers - prior.followers) / elapsedDays);
    }
    if (historicalRates.length > 0) {
      const averageDailyGrowth = historicalRates.reduce((total, value) => total + value, 0) / historicalRates.length;
      if (latestDailyGrowth >= 50 && latestDailyGrowth >= averageDailyGrowth * 3) {
        alerts.push({
          key: `competitor:growth:${competitor.id}:${utcDay(latest.day)}`,
          title: `${username} teve um salto de seguidores`,
          detail: `Crescimento de ${Math.round(latestDailyGrowth)} seguidores por dia, contra uma média de ${ratioLabel(averageDailyGrowth)} nos 30 dias anteriores.`,
          href,
        });
      }
    }
  }

  const currentWeekStart = new Date(now.getTime() - 7 * DAY_MS);
  const cadenceHistoryStart = new Date(now.getTime() - 37 * DAY_MS);
  const currentWeekPosts = competitor.posts.filter((post) => post.timestamp >= currentWeekStart && post.timestamp <= now).length;
  const cadenceHistoryPosts = competitor.posts.filter((post) => post.timestamp >= cadenceHistoryStart && post.timestamp < currentWeekStart).length;
  if (cadenceHistoryPosts > 0) {
    const weeklyAverage = (cadenceHistoryPosts / 30) * 7;
    const increased = currentWeekPosts >= weeklyAverage * 2;
    const reduced = currentWeekPosts <= weeklyAverage / 2;
    if (increased || reduced) {
      alerts.push({
        key: `competitor:cadence:${competitor.id}`,
        title: `${username} ${increased ? "aumentou" : "reduziu"} a frequência de publicação`,
        detail: `Foram ${currentWeekPosts} posts nos últimos 7 dias; a média anterior era ${ratioLabel(weeklyAverage)} por semana.`,
        href,
      });
    }
  }

  for (const post of competitor.posts.filter((item) => item.timestamp >= since2Days && item.timestamp <= now)) {
    const key = formatKey(post);
    const usedPreviously = competitor.posts.some((prior) =>
      prior.id !== post.id
      && prior.timestamp < post.timestamp
      && prior.timestamp >= new Date(post.timestamp.getTime() - 90 * DAY_MS)
      && formatKey(prior) === key,
    );
    if (!usedPreviously && !alerts.some((alert) => alert.key === `competitor:format:${competitor.id}:${key}`)) {
      alerts.push({
        key: `competitor:format:${competitor.id}:${key}`,
        title: `${username} começou a usar ${formatOf(post)}`,
        detail: "O formato não apareceu nas publicações dos 90 dias anteriores.",
        href,
      });
    }
  }

  return alerts;
}

/** Gera e reconcilia os alertas de concorrentes de uma agência após a sincronização diária. */
export async function generateCompetitorAlerts(agencyId: string, now = new Date()) {
  const competitors = await prisma.competitor.findMany({
    where: { agencyId, isOwn: false, category: "DIRECT" },
    select: {
      id: true,
      igUsername: true,
      posts: {
        where: { timestamp: { gte: new Date(now.getTime() - 92 * DAY_MS), lte: now } },
        select: { id: true, timestamp: true, mediaType: true, mediaProductType: true, likeCount: true, commentsCount: true },
      },
      snapshots: {
        where: { day: { gte: new Date(now.getTime() - 32 * DAY_MS), lte: now } },
        orderBy: { day: "asc" },
        select: { day: true, followers: true },
      },
    },
  });

  const active = competitors.flatMap((competitor) => detectCompetitorAlerts({
    id: competitor.id,
    username: competitor.igUsername,
    posts: competitor.posts,
    snapshots: competitor.snapshots,
  }, now));

  for (const alert of active) {
    await raiseSystemAlert({
      agencyId,
      key: alert.key,
      category: "AUTOMATION",
      severity: "INFO",
      title: alert.title,
      detail: alert.detail,
      href: alert.href,
    });
  }
  // Só reconcilia o que esta função gera. Os alertas de anúncio novo (competitor:newad:) vêm da
  // importação da Biblioteca e seriam fechados sem motivo se o prefixo fosse "competitor:".
  const keys = active.map((alert) => alert.key);
  for (const prefix of ["competitor:viral:", "competitor:growth:", "competitor:cadence:", "competitor:format:"]) {
    await resolveSystemAlertsByPrefix(agencyId, prefix, keys);
  }
  return { competitors: competitors.length, alerts: active.length };
}
