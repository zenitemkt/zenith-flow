import { analyzeCompetitor, formatOf, type AnalyticsPost } from "@/lib/competitor-analytics";

export interface ComparisonSnapshot {
  day: Date;
  followers: number | null;
}

export interface ComparisonProfile {
  id: string;
  username: string;
  isOwn: boolean;
  followers: number | null;
  posts: AnalyticsPost[];
  snapshots: ComparisonSnapshot[];
}

export interface RankingResult {
  key: "engagementRate" | "postsPerWeek" | "avgEngagement";
  label: string;
  rank: number;
  total: number;
  value: number | null;
  leader: string;
}

const TIME_RANGES = [
  { label: "Madrugada", start: 0, end: 5 },
  { label: "Manhã", start: 6, end: 11 },
  { label: "Tarde", start: 12, end: 17 },
  { label: "Noite", start: 18, end: 23 },
] as const;

function hashtagsOf(posts: AnalyticsPost[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const post of posts) {
    const tags = new Set((post.caption?.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.toLowerCase()));
    for (const tag of tags) result.set(tag, (result.get(tag) ?? 0) + 1);
  }
  return result;
}

function hourInSaoPaulo(date: Date): number {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).getUTCHours();
}

function timeRangeOf(date: Date): (typeof TIME_RANGES)[number] {
  const hour = hourInSaoPaulo(date);
  return TIME_RANGES.find((range) => hour >= range.start && hour <= range.end)!;
}

export function compareClientWithCompetitors(profiles: ComparisonProfile[], periodDays: number) {
  const own = profiles.find((profile) => profile.isOwn);
  if (!own) return null;
  const competitors = profiles.filter((profile) => !profile.isOwn);
  const analyzed = profiles.map((profile) => ({ profile, stats: analyzeCompetitor(profile.posts, profile.followers, periodDays) }));
  const ownAnalyzed = analyzed.find(({ profile }) => profile.id === own.id)!;

  const metrics = [
    { key: "engagementRate" as const, label: "Engajamento", value: (item: (typeof analyzed)[number]) => item.stats.engagementRate },
    { key: "postsPerWeek" as const, label: "Posts por semana", value: (item: (typeof analyzed)[number]) => item.stats.postsPerWeek },
    { key: "avgEngagement" as const, label: "Média de interações", value: (item: (typeof analyzed)[number]) => item.stats.avgEngagement },
  ];
  const rankings: RankingResult[] = metrics.map((metric) => {
    const values = analyzed
      .map((item) => ({ username: item.profile.username, value: metric.value(item) }))
      .filter((item): item is { username: string; value: number } => item.value !== null && Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value);
    const ownValue = metric.value(ownAnalyzed);
    return {
      key: metric.key,
      label: metric.label,
      rank: ownValue === null ? 0 : 1 + values.filter((item) => item.value > ownValue).length,
      total: analyzed.length,
      value: ownValue,
      leader: values[0]?.username ?? own.username,
    };
  });

  const ownHashtags = hashtagsOf(own.posts);
  const competitorHashtags = new Map<string, { profiles: Set<string>; uses: number }>();
  for (const competitor of competitors) {
    for (const [tag, uses] of hashtagsOf(competitor.posts)) {
      const entry = competitorHashtags.get(tag) ?? { profiles: new Set<string>(), uses: 0 };
      entry.profiles.add(competitor.id);
      entry.uses += uses;
      competitorHashtags.set(tag, entry);
    }
  }
  const hashtags = Array.from(competitorHashtags, ([tag, entry]) => ({ tag, competitorCount: entry.profiles.size, uses: entry.uses }))
    .filter((item) => item.competitorCount >= 3 && !ownHashtags.has(item.tag))
    .sort((a, b) => b.competitorCount - a.competitorCount || b.uses - a.uses)
    .slice(0, 12);

  const formatCounts = (posts: AnalyticsPost[]) => {
    const counts = new Map<string, number>();
    for (const post of posts) counts.set(formatOf(post), (counts.get(formatOf(post)) ?? 0) + 1);
    return counts;
  };
  const ownFormats = formatCounts(own.posts);
  const competitorFormats = formatCounts(competitors.flatMap((profile) => profile.posts));
  const competitorPostCount = competitors.reduce((total, profile) => total + profile.posts.length, 0);
  const formats = Array.from(competitorFormats, ([format, count]) => {
    const competitorShare = competitorPostCount ? (count / competitorPostCount) * 100 : 0;
    const ownShare = own.posts.length ? ((ownFormats.get(format) ?? 0) / own.posts.length) * 100 : 0;
    return { format, competitorShare, ownShare, gap: competitorShare - ownShare };
  })
    .filter((item) => item.gap >= 20)
    .sort((a, b) => b.gap - a.gap);

  const ownRanges = new Set<string>(own.posts.map((post) => timeRangeOf(post.timestamp).label));
  const competitorRanges = new Map<string, { profiles: Set<string>; posts: number; start: number; end: number }>();
  for (const competitor of competitors) {
    for (const post of competitor.posts) {
      const range = timeRangeOf(post.timestamp);
      const entry = competitorRanges.get(range.label) ?? { profiles: new Set<string>(), posts: 0, start: range.start, end: range.end };
      entry.profiles.add(competitor.id);
      entry.posts += 1;
      competitorRanges.set(range.label, entry);
    }
  }
  const timeRanges = Array.from(competitorRanges, ([label, entry]) => ({
    label,
    start: entry.start,
    end: entry.end,
    competitorCount: entry.profiles.size,
    posts: entry.posts,
  }))
    .filter((item) => !ownRanges.has(item.label))
    .sort((a, b) => b.competitorCount - a.competitorCount || b.posts - a.posts);

  return { own, competitors, rankings, opportunities: { hashtags, formats, timeRanges } };
}

