"use client";

import { useMemo, useState } from "react";
import type { RankingResult } from "@/lib/competitor-comparison";

interface ChartProfile {
  id: string;
  username: string;
  isOwn: boolean;
  followers: number | null;
  snapshots: { day: Date; followers: number | null }[];
  posts: { timestamp: Date; likeCount: number | null; commentsCount: number | null }[];
  /** Desde quando o perfil é monitorado — posts de antes não entram nos gráficos por semana (senão a semana de um perfil novo compara com meses de histórico do Instagram de outro). */
  trackedSince: Date;
}

type Metric = "followers" | "engagement" | "interactions" | "posts";
const METRIC_LABEL: Record<Metric, string> = {
  followers: "Evolução de seguidores",
  engagement: "Engajamento por semana",
  interactions: "Interações por semana",
  posts: "Posts por semana",
};
const METRIC_HINT: Record<Metric, string> = {
  followers: "Variação percentual desde o primeiro registro do período. A legenda mostra o total atual e a variação.",
  engagement: "Média de (curtidas + comentários) dividida pelos seguidores, por semana. Mostra quem engaja mais, não só quem posta mais.",
  interactions: "Soma de curtidas + comentários de cada semana. Quem tem a linha mais alta teve mais interação total.",
  posts: "Quantidade de posts publicados em cada semana. Quem tem a linha mais alta postou mais vezes.",
};

/** Segunda-feira (UTC) da semana do post — agrupa sem depender de fuso do navegador. */
function weekStart(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}

/** Série do perfil no metric escolhido: seguidores vira pontos diários; os outros, um ponto por semana. */
function seriesFor(profile: ChartProfile, metric: Metric): { day: Date; value: number }[] {
  if (metric === "followers") {
    return profile.snapshots.filter((s): s is { day: Date; followers: number } => s.followers !== null).map((s) => ({ day: s.day, value: s.followers }));
  }
  const weeks = new Map<number, { count: number; interactions: number }>();
  for (const post of profile.posts) {
    if (post.timestamp < profile.trackedSince) continue;
    const key = weekStart(post.timestamp);
    const w = weeks.get(key) ?? { count: 0, interactions: 0 };
    w.count += 1;
    w.interactions += (post.likeCount ?? 0) + (post.commentsCount ?? 0);
    weeks.set(key, w);
  }
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, w]) => ({
      day: new Date(key),
      value: metric === "posts" ? w.count : metric === "interactions" ? w.interactions : profile.followers ? (w.interactions / w.count / profile.followers) * 100 : 0,
    }));
}

interface ComparisonData {
  rankings: RankingResult[];
  competitors: { id: string }[];
  opportunities: {
    hashtags: { tag: string; competitorCount: number; uses: number }[];
    formats: { format: string; competitorShare: number; ownShare: number; gap: number }[];
    timeRanges: { label: string; start: number; end: number; competitorCount: number; posts: number }[];
  };
}

const COLORS = ["#FF2B00", "#175CD3", "#027A48", "#7A5AF8", "#DC6803", "#475467"];
const number = (value: number) => Math.round(value).toLocaleString("pt-BR");
const decimal = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function rankingValue(ranking: RankingResult): string {
  if (ranking.value === null) return "Sem dados";
  if (ranking.key === "engagementRate") return `${ranking.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  if (ranking.key === "postsPerWeek") return decimal(ranking.value);
  return number(ranking.value);
}

function formatValue(metric: Metric, value: number): string {
  if (metric === "engagement") return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  if (metric === "posts") return decimal(value);
  return number(value);
}

function TrendChart({ metric, profiles }: { metric: Metric; profiles: ChartProfile[] }) {
  const isFollowers = metric === "followers";
  const series = useMemo(
    () =>
      profiles
        .map((profile, index) => ({
          ...profile,
          color: profile.isOwn ? COLORS[0]! : COLORS[(index % (COLORS.length - 1)) + 1]!,
          points: seriesFor(profile, metric),
        }))
        .filter((profile) => profile.points.length > 0),
    [profiles, metric],
  );
  const all = series.flatMap((profile) => profile.points);
  if (all.length < 2) {
    return <p className="py-8 text-center text-sm text-[#667085]">O gráfico aparecerá depois de pelo menos dois registros {isFollowers ? "diários" : "semanais"}.</p>;
  }

  const width = 900;
  const height = 280;
  const left = 64;
  const right = 20;
  const top = 18;
  const bottom = 42;
  const minDate = Math.min(...all.map((point) => point.day.getTime()));
  const maxDate = Math.max(...all.map((point) => point.day.getTime()));
  const growth = (profile: (typeof series)[number], value: number) => {
    if (!isFollowers) return value;
    const base = profile.points[0]?.value ?? 0;
    return base > 0 ? ((value - base) / base) * 100 : 0;
  };
  const changes = series.flatMap((profile) => profile.points.map((point) => growth(profile, point.value)));
  const rawMin = Math.min(0, ...changes);
  const rawMax = Math.max(0, ...changes);
  const padding = isFollowers ? Math.max(0.25, (rawMax - rawMin) * 0.12) : Math.max(rawMax * 0.15, metric === "posts" ? 1 : 0.2);
  const minChange = isFollowers ? rawMin - padding : 0;
  const maxChange = rawMax + padding;
  const x = (date: Date) => left + ((date.getTime() - minDate) / Math.max(1, maxDate - minDate)) * (width - left - right);
  const y = (change: number) => top + ((maxChange - change) / Math.max(0.01, maxChange - minChange)) * (height - top - bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => minChange + ((maxChange - minChange) * index) / 4).reverse();
  const shortDate = (timestamp: number) => new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  const dateLabel = (timestamp: number) => (isFollowers ? shortDate(timestamp) : `Semana de ${shortDate(timestamp)}`);
  const tickLabel = (value: number) => (isFollowers ? `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%` : formatValue(metric, value));

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={METRIC_LABEL[metric]} className="min-w-[680px]">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#EAECF0" strokeWidth="1" />
              <text x={left - 10} y={y(tick) + 4} textAnchor="end" fill="#667085" fontSize="11">{tickLabel(tick)}</text>
            </g>
          ))}
          {series.map((profile) => {
            const path = profile.points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.day)} ${y(growth(profile, point.value))}`).join(" ");
            return (
              <g key={profile.id}>
                {profile.points.length > 1 && <path d={path} fill="none" stroke={profile.color} strokeWidth={profile.isOwn ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />}
                {profile.points.map((point) => <circle key={point.day.toISOString()} cx={x(point.day)} cy={y(growth(profile, point.value))} r={profile.isOwn ? 3.5 : 2.5} fill={profile.color} />)}
              </g>
            );
          })}
          <text x={left} y={height - 12} fill="#667085" fontSize="11">{dateLabel(minDate)}</text>
          <text x={width - right} y={height - 12} textAnchor="end" fill="#667085" fontSize="11">{dateLabel(maxDate)}</text>
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {series.map((profile) => (
          <span key={profile.id} className="flex items-center gap-1.5 text-xs text-[#475467]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: profile.color }} />
            @{profile.username}
            {profile.isOwn ? " (cliente)" : ""} ·{" "}
            {isFollowers
              ? `${number(profile.points.at(-1)?.value ?? 0)} · ${tickLabel(growth(profile, profile.points.at(-1)?.value ?? 0))}`
              : `última semana: ${formatValue(metric, profile.points.at(-1)?.value ?? 0)}`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ClientCompetitorComparison({ comparison, profiles, days }: { comparison: ComparisonData; profiles: ChartProfile[]; days: number }) {
  const [metric, setMetric] = useState<Metric>("followers");
  const opportunityCount = comparison.opportunities.hashtags.length + comparison.opportunities.formats.length + comparison.opportunities.timeRanges.length;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div>
        <h2 className="text-base font-semibold text-[#101828]">Cliente frente aos concorrentes</h2>
        <p className="text-xs text-[#667085]">Posição e oportunidades encontradas nos últimos {days} dias.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {comparison.rankings.map((ranking) => (
          <div key={ranking.key} className="rounded-lg border border-[#EAECF0] bg-[#F9FAFB] p-3">
            <p className="text-xs text-[#667085]">{ranking.label}</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-2xl font-semibold text-[#101828]">{ranking.rank ? `${ranking.rank}º` : "—"} <span className="text-sm font-normal text-[#667085]">de {ranking.total}</span></p>
              <p className="text-sm font-semibold text-[#FF2B00]">{rankingValue(ranking)}</p>
            </div>
            {ranking.rank > 1 && <p className="mt-1 text-[11px] text-[#98A2B3]">Líder: @{ranking.leader}</p>}
          </div>
        ))}
      </div>

      <div className="border-t border-[#EAECF0] pt-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#101828]">{METRIC_LABEL[metric]}</h3>
          <select aria-label="Métrica do gráfico" value={metric} onChange={(event) => setMetric(event.target.value as Metric)} className="h-8 rounded-lg border border-[#D0D5DD] bg-white px-2 text-xs font-medium text-[#344054] outline-none focus:border-[#FF2B00]">
            <option value="followers">Evolução de seguidores</option>
            <option value="engagement">Engajamento por semana</option>
            <option value="interactions">Interações por semana</option>
            <option value="posts">Posts por semana</option>
          </select>
        </div>
        <p className="mb-3 text-xs text-[#667085]">{METRIC_HINT[metric]}</p>
        <TrendChart metric={metric} profiles={profiles} />
      </div>

      <div className="border-t border-[#EAECF0] pt-4">
        <h3 className="text-sm font-semibold text-[#101828]">O que os concorrentes fazem e o cliente não</h3>
        <p className="mb-3 text-xs text-[#667085]">Pistas para testar. Os números mostram frequência, não garantem resultado.</p>
        {opportunityCount === 0 ? (
          <p className="rounded-lg bg-[#F9FAFB] px-3 py-4 text-sm text-[#667085]">Ainda não há uma diferença forte com dados suficientes neste período.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-[#EAECF0] p-3">
              <h4 className="text-sm font-semibold text-[#101828]">Hashtags em comum</h4>
              <p className="mb-2 text-[11px] text-[#98A2B3]">Usadas por 3 ou mais concorrentes.</p>
              {comparison.opportunities.hashtags.length === 0 && <p className="text-xs text-[#667085]">Nenhuma encontrada.</p>}
              <div className="flex flex-wrap gap-1.5">
                {comparison.opportunities.hashtags.map((item) => (
                  <span key={item.tag} className="rounded-full bg-[#EFF8FF] px-2 py-1 text-xs text-[#175CD3]" title={`${item.uses} usos`}>
                    {item.tag} · {item.competitorCount} perfis
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#EAECF0] p-3">
              <h4 className="text-sm font-semibold text-[#101828]">Formatos mais explorados</h4>
              <p className="mb-2 text-[11px] text-[#98A2B3]">Diferença de pelo menos 20 pontos percentuais.</p>
              {comparison.opportunities.formats.length === 0 && <p className="text-xs text-[#667085]">Nenhum encontrado.</p>}
              {comparison.opportunities.formats.map((item) => (
                <div key={item.format} className="mb-2 last:mb-0">
                  <p className="flex justify-between text-xs text-[#344054]"><span className="font-medium">{item.format}</span><span>+{decimal(item.gap)} p.p.</span></p>
                  <p className="text-[11px] text-[#98A2B3]">Concorrentes {decimal(item.competitorShare)}% · cliente {decimal(item.ownShare)}%</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[#EAECF0] p-3">
              <h4 className="text-sm font-semibold text-[#101828]">Faixas de horário</h4>
              <p className="mb-2 text-[11px] text-[#98A2B3]">Usadas pelos concorrentes e ainda não pelo cliente.</p>
              {comparison.opportunities.timeRanges.length === 0 && <p className="text-xs text-[#667085]">Nenhuma encontrada.</p>}
              {comparison.opportunities.timeRanges.map((item) => (
                <p key={item.label} className="flex items-center justify-between border-t border-[#F2F4F7] py-1.5 text-xs first:border-0">
                  <span className="font-medium text-[#344054]">{item.label} ({item.start}h–{item.end}h)</span>
                  <span className="text-[#667085]">{item.posts} posts</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

