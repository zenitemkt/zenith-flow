import { prisma } from "@zenite-mkt/db";
import { analyzeCompetitor } from "@/lib/competitor-analytics";
import { compareClientWithCompetitors } from "@/lib/competitor-comparison";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface MonthlyCompetitorReportContent {
  title: string;
  summary: string;
  marketChanges: string[];
  competitorWins: { title: string; evidence: string; implication: string }[];
  clientPosition: { strengths: string[]; gaps: string[] };
  actions: { title: string; why: string; execution: string; metric: string }[];
  limitations: string[];
  sources: { profiles: number; competitorPosts: number; clientPosts: number; ads: number };
}

const strings = (value: unknown, max = 12) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim().slice(0, 1200)).slice(0, max)
  : [];

export function parseMonthlyCompetitorReport(value: unknown): MonthlyCompetitorReportContent {
  const source = typeof value === "string" ? JSON.parse(value) : value;
  if (!source || typeof source !== "object") throw new Error("Relatório inválido.");
  const data = source as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 200) : "";
  const summary = typeof data.summary === "string" ? data.summary.trim().slice(0, 4000) : "";
  const position = data.clientPosition && typeof data.clientPosition === "object" ? data.clientPosition as Record<string, unknown> : {};
  const wins = Array.isArray(data.competitorWins) ? data.competitorWins.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      title: typeof row.title === "string" ? row.title.trim().slice(0, 300) : "",
      evidence: typeof row.evidence === "string" ? row.evidence.trim().slice(0, 1200) : "",
      implication: typeof row.implication === "string" ? row.implication.trim().slice(0, 1200) : "",
    };
  }).filter((item) => item.title && item.evidence).slice(0, 8) : [];
  const actions = Array.isArray(data.actions) ? data.actions.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      title: typeof row.title === "string" ? row.title.trim().slice(0, 300) : "",
      why: typeof row.why === "string" ? row.why.trim().slice(0, 1200) : "",
      execution: typeof row.execution === "string" ? row.execution.trim().slice(0, 1200) : "",
      metric: typeof row.metric === "string" ? row.metric.trim().slice(0, 500) : "",
    };
  }).filter((item) => item.title && item.why && item.execution && item.metric).slice(0, 5) : [];
  const rawSources = data.sources && typeof data.sources === "object" ? data.sources as Record<string, unknown> : {};
  const count = (key: string) => Math.max(0, Math.round(Number(rawSources[key]) || 0));
  const result = {
    title,
    summary,
    marketChanges: strings(data.marketChanges),
    competitorWins: wins,
    clientPosition: { strengths: strings(position.strengths), gaps: strings(position.gaps) },
    actions,
    limitations: strings(data.limitations),
    sources: { profiles: count("profiles"), competitorPosts: count("competitorPosts"), clientPosts: count("clientPosts"), ads: count("ads") },
  };
  if (!result.title || !result.summary || result.actions.length !== 5) throw new Error("A IA não devolveu o relatório completo com cinco ações.");
  return result;
}

export function monthFromKey(key: string): Date {
  const match = key.match(MONTH_RE);
  if (!match) throw new Error("Mês inválido.");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousClosedMonth(now = new Date()): Date {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const parts = Object.fromEntries(local.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 2, 1));
}

export const monthLabel = (month: Date) => month.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

function firstLine(value: string | null) {
  return (value ?? "").split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 240) ?? null;
}

async function reportSource(clientId: string, agencyId: string, month: Date) {
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const days = Math.round((end.getTime() - month.getTime()) / 86_400_000);
  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
    select: {
      id: true,
      name: true,
      competitors: {
        orderBy: [{ isOwn: "desc" }, { igUsername: "asc" }],
        select: {
          id: true, igUsername: true, isOwn: true, category: true, followers: true,
          posts: { where: { timestamp: { gte: month, lt: end } }, orderBy: { timestamp: "asc" } },
          snapshots: { where: { day: { gte: month, lt: end } }, orderBy: { day: "asc" }, select: { day: true, followers: true } },
          ads: { where: { OR: [{ createdAt: { gte: month, lt: end } }, { startedAt: { gte: month, lt: end } }] }, select: { active: true, startedAt: true, lastSeenAt: true, headline: true, bodyText: true, format: true } },
        },
      },
    },
  });
  if (!client) throw new Error("Cliente não encontrado.");
  const own = client.competitors.find((profile) => profile.isOwn);
  const rivals = client.competitors.filter((profile) => !profile.isOwn && profile.category === "DIRECT");
  if (!own) throw new Error("Cadastre o perfil do próprio cliente como base de comparação.");
  if (rivals.length === 0) throw new Error("Cadastre pelo menos um concorrente antes de gerar o relatório.");
  const analyzed = client.competitors.map((profile) => {
    const stats = analyzeCompetitor(profile.posts, profile.followers, days);
    const first = profile.snapshots.find((snapshot) => snapshot.followers !== null)?.followers ?? null;
    const last = [...profile.snapshots].reverse().find((snapshot) => snapshot.followers !== null)?.followers ?? null;
    return {
      username: profile.igUsername,
      isOwn: profile.isOwn,
      role: profile.isOwn ? "CLIENT" : profile.category,
      followers: profile.followers,
      followerChange: first !== null && last !== null ? last - first : null,
      posts: stats.posts,
      postsPerWeek: Number(stats.postsPerWeek.toFixed(2)),
      avgInteractions: Math.round(stats.avgEngagement),
      engagementRate: stats.engagementRate === null ? null : Number(stats.engagementRate.toFixed(2)),
      formats: stats.formatMix.slice(0, 4).map((item) => ({ name: item.name, posts: item.count, avgInteractions: Math.round(item.avgEngagement) })),
      themes: stats.themes.slice(0, 5).map((item) => ({ name: item.name, posts: item.count, avgInteractions: Math.round(item.avgEngagement), example: item.examples[0] ?? null })),
      hooks: stats.hooks.slice(0, 5).map((item) => ({ name: item.name, posts: item.count, avgInteractions: Math.round(item.avgEngagement), example: item.examples[0] ?? null })),
      topPosts: stats.top.slice(0, 5).map((post) => ({ format: post.format, interactions: post.engagement, relativeToAverage: Number(post.lift.toFixed(2)), opening: firstLine(post.caption), url: post.permalink })),
      ads: profile.ads.map((ad) => ({ active: ad.active, format: ad.format, opening: ad.headline ?? firstLine(ad.bodyText), daysObserved: Math.max(1, Math.ceil((ad.lastSeenAt.getTime() - (ad.startedAt ?? month).getTime()) / 86_400_000)) })),
    };
  });
  const comparison = compareClientWithCompetitors(client.competitors.map((profile) => ({ id: profile.id, username: profile.igUsername, isOwn: profile.isOwn, category: profile.category, followers: profile.followers, posts: profile.posts, snapshots: profile.snapshots })), days);
  const clientPosts = own.posts.length;
  const competitorPosts = rivals.reduce((total, profile) => total + profile.posts.length, 0);
  const ads = rivals.reduce((total, profile) => total + profile.ads.length, 0);
  return {
    source: {
      client: client.name,
      month: monthKey(month),
      period: { start: month.toISOString(), endExclusive: end.toISOString(), days },
      profiles: analyzed,
      comparison: comparison ? { rankings: comparison.rankings, opportunities: comparison.opportunities } : null,
      sourceCounts: { profiles: client.competitors.length, competitorPosts, clientPosts, ads },
    },
    counts: { profiles: client.competitors.length, competitorPosts, clientPosts, ads },
  };
}

async function callClaude(source: unknown): Promise<MonthlyCompetitorReportContent> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Chave da Claude não configurada.");
  const prompt = `Você é estrategista sênior de uma agência brasileira. Gere o relatório mensal de concorrência usando SOMENTE o JSON de fontes abaixo.

Regras:
- Diferencie fato observado de interpretação.
- Não invente alcance, impressões, vendas, investimento, público ou causalidade.
- Compare o perfil CLIENT somente com os perfis DIRECT. Perfis REFERENCE servem para inspiração e nunca entram em ranking, posição ou disputa.
- Use perfis REFERENCE apenas para destacar práticas, temas e estruturas que podem inspirar o cliente.
- Se a amostra for pequena, diga isso nas limitações.
- Produza exatamente 5 ações práticas, proporcionais a uma empresa com equipe pequena.
- Cada evidência deve citar perfil, quantidade ou métrica presente na fonte.
- Responda somente JSON válido, sem markdown, seguindo exatamente este formato:
{"title":"...","summary":"...","marketChanges":["..."],"competitorWins":[{"title":"...","evidence":"...","implication":"..."}],"clientPosition":{"strengths":["..."],"gaps":["..."]},"actions":[{"title":"...","why":"...","execution":"...","metric":"..."}],"limitations":["..."],"sources":{"profiles":0,"competitorPosts":0,"clientPosts":0,"ads":0}}

FONTES:
${JSON.stringify(source)}`;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.COMPETITOR_AI_MODEL || "claude-sonnet-5-5", max_tokens: 6000, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Claude ${response.status}: ${JSON.stringify(data?.error ?? data).slice(0, 250)}`);
  const text = ((data.content ?? []) as { type: string; text?: string }[]).filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!text) throw new Error("A IA devolveu um relatório vazio.");
  const parsed = parseMonthlyCompetitorReport(text);
  parsed.sources = (source as { sourceCounts: MonthlyCompetitorReportContent["sources"] }).sourceCounts;
  return parsed;
}

export async function generateMonthlyCompetitorReport(input: { clientId: string; agencyId: string; month: Date; actorUserId?: string | null; force?: boolean }) {
  const existing = await prisma.competitorReport.findFirst({ where: { clientId: input.clientId, month: input.month, client: { agencyId: input.agencyId } } });
  if (existing && !input.force) return existing;
  const { source, counts } = await reportSource(input.clientId, input.agencyId, input.month);
  const content = await callClaude(source);
  content.sources = counts;
  const generatedAt = new Date();
  const report = await prisma.competitorReport.upsert({
    where: { clientId_month: { clientId: input.clientId, month: input.month } },
    create: { clientId: input.clientId, month: input.month, content: JSON.stringify(content), generatedAt },
    update: { content: JSON.stringify(content), generatedAt },
  });
  await prisma.auditLog.create({ data: { agencyId: input.agencyId, actorUserId: input.actorUserId ?? null, actorType: input.actorUserId ? "user" : "system", action: existing ? "competitor_report.regenerated" : "competitor_report.generated", resourceType: "competitor_report", resourceId: report.id, metadata: { clientId: input.clientId, month: monthKey(input.month), sources: counts } } });
  return report;
}
