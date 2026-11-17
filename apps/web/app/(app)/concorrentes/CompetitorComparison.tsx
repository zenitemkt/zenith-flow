import type { RankingResult } from "@/lib/competitor-comparison";

interface ChartProfile {
  id: string;
  username: string;
  isOwn: boolean;
  snapshots: { day: Date; followers: number | null }[];
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

function FollowersChart({ profiles }: { profiles: ChartProfile[] }) {
  const series = profiles.map((profile, index) => ({
    ...profile,
    color: profile.isOwn ? COLORS[0]! : COLORS[(index % (COLORS.length - 1)) + 1]!,
    points: profile.snapshots.filter((snapshot): snapshot is { day: Date; followers: number } => snapshot.followers !== null),
  })).filter((profile) => profile.points.length > 0);
  const all = series.flatMap((profile) => profile.points);
  if (all.length < 2) return <p className="py-8 text-center text-sm text-[#667085]">O gráfico aparecerá depois de pelo menos dois registros diários.</p>;

  const width = 900;
  const height = 280;
  const left = 64;
  const right = 20;
  const top = 18;
  const bottom = 42;
  const minDate = Math.min(...all.map((point) => point.day.getTime()));
  const maxDate = Math.max(...all.map((point) => point.day.getTime()));
  const growth = (profile: (typeof series)[number], followers: number) => {
    const base = profile.points[0]?.followers ?? 0;
    return base > 0 ? ((followers - base) / base) * 100 : 0;
  };
  const changes = series.flatMap((profile) => profile.points.map((point) => growth(profile, point.followers)));
  const rawMin = Math.min(0, ...changes);
  const rawMax = Math.max(0, ...changes);
  const padding = Math.max(0.25, (rawMax - rawMin) * 0.12);
  const minChange = rawMin - padding;
  const maxChange = rawMax + padding;
  const x = (date: Date) => left + ((date.getTime() - minDate) / Math.max(1, maxDate - minDate)) * (width - left - right);
  const y = (change: number) => top + ((maxChange - change) / Math.max(0.01, maxChange - minChange)) * (height - top - bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => minChange + ((maxChange - minChange) * index) / 4).reverse();
  const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  const percent = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução de seguidores do cliente e dos concorrentes" className="min-w-[680px]">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#EAECF0" strokeWidth="1" />
              <text x={left - 10} y={y(tick) + 4} textAnchor="end" fill="#667085" fontSize="11">{percent(tick)}</text>
            </g>
          ))}
          {series.map((profile) => {
            const path = profile.points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.day)} ${y(growth(profile, point.followers))}`).join(" ");
            return (
              <g key={profile.id}>
                {profile.points.length > 1 && <path d={path} fill="none" stroke={profile.color} strokeWidth={profile.isOwn ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />}
                {profile.points.map((point) => <circle key={point.day.toISOString()} cx={x(point.day)} cy={y(growth(profile, point.followers))} r={profile.isOwn ? 3.5 : 2.5} fill={profile.color} />)}
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
            @{profile.username}{profile.isOwn ? " (cliente)" : ""} · {number(profile.points.at(-1)?.followers ?? 0)} · {percent(growth(profile, profile.points.at(-1)?.followers ?? 0))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ClientCompetitorComparison({ comparison, profiles, days }: { comparison: ComparisonData; profiles: ChartProfile[]; days: number }) {
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
        <h3 className="mb-1 text-sm font-semibold text-[#101828]">Evolução de seguidores</h3>
        <p className="mb-3 text-xs text-[#667085]">Variação percentual desde o primeiro registro do período. A legenda mostra o total atual e a variação.</p>
        <FollowersChart profiles={profiles} />
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

