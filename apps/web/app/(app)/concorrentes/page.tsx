import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { getHiddenClientIds, visibleClientWhere } from "@/lib/client-access";
import { analyzeCompetitor } from "@/lib/competitor-analytics";
import { compareClientWithCompetitors } from "@/lib/competitor-comparison";
import { AddCompetitorForm, CompetitorActions, CompetitorFilters } from "./CompetitorControls";
import { ClientCompetitorComparison } from "./CompetitorComparison";
import { CompetitorAdsIntegration } from "./CompetitorAdsIntegration";
import { CompetitorMonthlyReports } from "./CompetitorMonthlyReports";
import { GoogleReviewsComparison, GoogleReviewsPanel } from "./CompetitorGoogleReviews";
import { monthKey, monthLabel, parseMonthlyCompetitorReport, previousClosedMonth } from "@/lib/competitor-reports";

export const dynamic = "force-dynamic";

const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const dec = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number | null) => (v === null ? "—" : `${dec(v, 2)}%`);
const CARD = "rounded-xl border border-[#E4E7EC] bg-white p-4";
const H2 = "mb-3 text-sm font-semibold text-[#101828]";
const TH = "px-2 py-1.5 text-left text-xs font-medium text-[#667085]";
const TD = "px-2 py-1.5 text-sm text-[#101828]";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-[#F9FAFB] p-3">
      <p className="text-xs text-[#667085]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-[#101828]">{value}</p>
      {hint && <p className="text-[11px] text-[#98A2B3]">{hint}</p>}
    </div>
  );
}

function Lift({ value }: { value: number }) {
  if (!value) return null;
  const cls = value >= 1.15 ? "bg-[#ECFDF3] text-[#027A48]" : value <= 0.85 ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2F4F7] text-[#344054]";
  return <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{dec(value)}x a média</span>;
}

export default async function ConcorrentesPage({ searchParams }: { searchParams: { cliente?: string; c?: string; dias?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  if (isClientRole(membership.role)) redirect("/");
  const agencyId = membership.agencyId;
  const hidden = await getHiddenClientIds(agencyId, session.user.id);
  const clients = await prisma.client.findMany({ where: { agencyId, ...visibleClientWhere(hidden) }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  if (clients.length === 0) return <p className="text-sm text-[#667085]">Cadastre um cliente para analisar os concorrentes dele.</p>;

  const days = [30, 90, 180, 365].includes(Number(searchParams.dias)) ? Number(searchParams.dias) : 90;
  const since = new Date(Date.now() - days * 86_400_000);
  const picked = searchParams.c ? await prisma.competitor.findFirst({ where: { id: searchParams.c, agencyId }, select: { clientId: true } }) : null;
  const clientId = clients.find((c) => c.id === (picked?.clientId ?? searchParams.cliente))?.id ?? clients[0]!.id;

  const profiles = await prisma.competitor.findMany({
    where: { agencyId, clientId },
    orderBy: [{ isOwn: "desc" }, { followers: "desc" }],
    include: {
      posts: { where: { timestamp: { gte: since } } },
      snapshots: { where: { day: { gte: since } }, orderBy: { day: "asc" } },
      ads: { orderBy: [{ active: "desc" }, { startedAt: "desc" }, { lastSeenAt: "desc" }] },
      googleSnapshots: { where: { day: { gte: since } }, orderBy: { day: "asc" } },
    },
  });
  const agencyIntegration = await prisma.agency.findUnique({ where: { id: agencyId }, select: { competitorAdsTokenHash: true } });
  const reportRows = await prisma.competitorReport.findMany({ where: { clientId }, orderBy: { month: "desc" }, take: 12 });
  const monthlyReports = reportRows.flatMap((report) => {
    try {
      return [{ id: report.id, monthLabel: monthLabel(report.month), generatedLabel: report.generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), content: parseMonthlyCompetitorReport(report.content) }];
    } catch {
      return [];
    }
  });
  const targetMonth = previousClosedMonth();
  const rows = profiles.map((p) => {
    const stats = analyzeCompetitor(p.posts, p.followers, days);
    const first = p.snapshots.find((s) => s.followers !== null)?.followers ?? null;
    const growth = first !== null && p.followers !== null ? p.followers - first : null;
    return { p, stats, growth, snapshotDays: p.snapshots.length };
  });
  const current = rows.find((r) => r.p.id === searchParams.c) ?? rows[0] ?? null;
  const comparison = compareClientWithCompetitors(profiles.map((profile) => ({
    id: profile.id,
    username: profile.igUsername,
    isOwn: profile.isOwn,
    followers: profile.followers,
    posts: profile.posts,
    snapshots: profile.snapshots,
  })), days);
  const href = (id: string) => `/concorrentes?cliente=${clientId}&dias=${days}&c=${id}`;
  const maxHeat = current ? Math.max(1, ...current.stats.heatmap.flat()) : 1;
  const maxHookAverage = current ? Math.max(1, ...current.stats.hooks.map((hook) => hook.avgEngagement)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Análise de Concorrentes</h1>
          <p className="text-sm text-[#667085]">O que os concorrentes de cada cliente postam no Instagram, o que funciona para eles e como o cliente se compara. Atualiza sozinho todo dia.</p>
        </div>
        <CompetitorFilters clients={clients} clientId={clientId} days={days} competitorId={current?.p.id ?? null} />
      </div>

      <AddCompetitorForm clientId={clientId} />

      <CompetitorAdsIntegration configured={Boolean(agencyIntegration?.competitorAdsTokenHash)} competitorId={current?.p.id ?? null} username={current?.p.igUsername ?? null} />

      <CompetitorMonthlyReports clientId={clientId} targetMonth={monthKey(targetMonth)} targetLabel={monthLabel(targetMonth)} reports={monthlyReports} />

      <GoogleReviewsComparison days={days} profiles={profiles.map((profile) => ({ id: profile.id, username: profile.igUsername, isOwn: profile.isOwn, rating: profile.googleRating, reviewCount: profile.googleReviewCount, firstReviewCount: profile.googleSnapshots.find((snapshot) => snapshot.reviewCount !== null)?.reviewCount ?? null }))} />

      {comparison ? (
        <ClientCompetitorComparison comparison={comparison} profiles={profiles.map((profile) => ({ id: profile.id, username: profile.igUsername, isOwn: profile.isOwn, snapshots: profile.snapshots }))} days={days} />
      ) : rows.length > 0 ? (
        <section className={`${CARD} border-dashed`}>
          <h2 className={H2}>Comparar o cliente com os concorrentes</h2>
          <p className="text-sm text-[#667085]">Adicione o Instagram do cliente acima e marque “Este é o perfil do próprio cliente”. O ranking, o gráfico e as oportunidades aparecerão aqui.</p>
        </section>
      ) : null}

      {rows.length > 0 && (
        <section className={`${CARD} overflow-x-auto`}>
          <h2 className={H2}>Todos os perfis ({days} dias)</h2>
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                {["Perfil", "Seguidores", "Crescimento", "Posts", "Posts/semana", "Média de interações", "Engajamento", "Formato mais usado", "Melhor dia"].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, stats, growth }) => {
                const bestDay = [...stats.days].filter((d) => d.count > 0).sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
                return (
                  <tr key={p.id} className={`border-t border-[#F2F4F7] ${current?.p.id === p.id ? "bg-[#FFF4ED]" : ""}`}>
                    <td className={TD}>
                      <Link href={href(p.id)} className="font-medium hover:underline">
                        @{p.igUsername}
                      </Link>
                      {p.isOwn && <span className="ml-1.5 rounded-full bg-[#EFF8FF] px-1.5 py-0.5 text-[10px] font-medium text-[#175CD3]">Cliente</span>}
                    </td>
                    <td className={TD}>{p.followers !== null ? int(p.followers) : "—"}</td>
                    <td className={TD}>{growth === null ? "—" : `${growth >= 0 ? "+" : ""}${int(growth)}`}</td>
                    <td className={TD}>{stats.posts}</td>
                    <td className={TD}>{dec(stats.postsPerWeek)}</td>
                    <td className={TD}>{int(stats.avgEngagement)}</td>
                    <td className={TD}>{pct(stats.engagementRate)}</td>
                    <td className={TD}>{stats.formatMix[0]?.name ?? "—"}</td>
                    <td className={TD}>{bestDay?.day ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[#98A2B3]">Engajamento = (curtidas + comentários) por post, dividido pelos seguidores. O Instagram não mostra alcance nem visualizações de outras contas. Crescimento conta a partir do dia em que o perfil foi cadastrado.</p>
        </section>
      )}

      {current && (
        <>
          <section className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {current.p.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.p.pictureUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full object-cover" />
                )}
                <div>
                  <p className="text-base font-semibold text-[#101828]">
                    {current.p.displayName || `@${current.p.igUsername}`}{" "}
                    <a href={`https://instagram.com/${current.p.igUsername}`} target="_blank" rel="noopener noreferrer" className="text-sm font-normal text-[#FF2B00] hover:underline">
                      @{current.p.igUsername}
                    </a>
                  </p>
                  {current.p.biography && <p className="max-w-xl whitespace-pre-line text-xs text-[#667085]">{current.p.biography}</p>}
                  <p className="mt-1 text-[11px] text-[#98A2B3]">
                    {current.p.lastSyncAt ? `Atualizado em ${current.p.lastSyncAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : "Ainda não atualizado"}
                    {current.p.website ? ` · ${current.p.website}` : ""}
                  </p>
                </div>
              </div>
              <CompetitorActions competitorId={current.p.id} days={days} username={current.p.igUsername} hasReport={Boolean(current.p.aiReport)} />
            </div>
            {current.p.lastError && <p className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">Última atualização falhou: {current.p.lastError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Stat label="Seguidores" value={current.p.followers !== null ? int(current.p.followers) : "—"} hint={current.growth !== null && current.snapshotDays > 1 ? `${current.growth >= 0 ? "+" : ""}${int(current.growth)} no período` : "histórico começa agora"} />
              <Stat label="Posts no período" value={String(current.stats.posts)} hint={`${dec(current.stats.postsPerWeek)} por semana`} />
              <Stat label="Média de curtidas" value={int(current.stats.avgLikes)} hint={current.stats.hiddenLikes ? `${current.stats.hiddenLikes} post(s) com curtidas ocultas` : undefined} />
              <Stat label="Média de comentários" value={int(current.stats.avgComments)} />
              <Stat label="Engajamento" value={pct(current.stats.engagementRate)} hint="por post, sobre seguidores" />
              <Stat label="Intervalo entre posts" value={`${dec(current.stats.avgGapDays)} dias`} hint={`maior pausa: ${dec(current.stats.longestGapDays, 0)} dias`} />
            </div>
          </section>

          <GoogleReviewsPanel competitorId={current.p.id} initialQuery={`${current.p.displayName || current.p.igUsername}`} place={{ id: current.p.googlePlaceId, name: current.p.googlePlaceName, address: current.p.googlePlaceAddress, rating: current.p.googleRating, reviewCount: current.p.googleReviewCount, syncedAt: current.p.googleLastSyncAt?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) ?? null, error: current.p.googleLastError }} />

          <section className={CARD}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><h2 className="text-sm font-semibold text-[#101828]">Anúncios na Meta</h2><p className="text-xs text-[#667085]">Capturados pela extensão na Biblioteca de Anúncios.</p></div>
              <span className="text-xs text-[#667085]">{current.p.ads.filter((ad) => ad.active).length} ativos · {current.p.ads.length} guardados</span>
            </div>
            {current.p.ads.length === 0 ? (
              <p className="rounded-lg bg-[#F9FAFB] px-3 py-5 text-center text-sm text-[#667085]">Nenhum anúncio enviado para este perfil. Configure a extensão acima, abra a Biblioteca da Meta e envie os anúncios carregados.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {current.p.ads.map((ad) => {
                  const start = ad.startedAt ?? ad.createdAt;
                  const end = ad.active ? new Date() : ad.lastSeenAt;
                  const daysOnline = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
                  return (
                    <article key={ad.id} className="overflow-hidden rounded-lg border border-[#EAECF0]">
                      {ad.creativeUrls[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.creativeUrls[0]} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-video w-full bg-[#F2F4F7] object-cover" />
                      )}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="text-2xl font-semibold text-[#101828]">{daysOnline} <span className="text-sm font-normal text-[#667085]">dias no ar</span></p><p className="text-[11px] text-[#98A2B3]">ID {ad.adArchiveId}</p></div>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ad.active ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F2F4F7] text-[#667085]"}`}>{ad.active ? "Ativo" : "Não apareceu na última carga"}</span>
                        </div>
                        {ad.headline && <p className="mt-2 text-sm font-semibold text-[#101828]">{ad.headline}</p>}
                        {ad.bodyText && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#667085]">{ad.bodyText}</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">{ad.platforms.map((platform) => <span key={platform} className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] text-[#475467]">{platform}</span>)}{ad.format && <span className="rounded-full bg-[#FFF4ED] px-2 py-0.5 text-[11px] text-[#C4320A]">{ad.format}</span>}</div>
                        {ad.linkUrl && <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#FF2B00] hover:underline">Abrir destino do anúncio</a>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {current.stats.posts === 0 ? (
            <p className={`${CARD} text-sm text-[#667085]`}>Nenhum post neste período. Aumente o período ou clique em &quot;Atualizar agora&quot;.</p>
          ) : (
            <>
              {current.p.aiReport && (
                <section className={CARD}>
                  <h2 className={H2}>
                    Análise dos melhores posts (IA){" "}
                    <span className="font-normal text-[#98A2B3]">
                      · {current.p.aiReportDays} dias · gerada em {current.p.aiReportAt?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#344054]">{current.p.aiReport}</p>
                </section>
              )}

              <section className={CARD}>
                <h2 className={H2}>Melhores posts do período</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {current.stats.top.map((post, i) => (
                    <a key={post.id} href={post.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="flex flex-col overflow-hidden rounded-lg border border-[#EEF0F3] hover:border-[#FF2B00]">
                      <div className="relative aspect-square bg-[#F2F4F7]">
                        {post.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.thumbnailUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs text-[#98A2B3]">Sem prévia</span>
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#101828] px-2 py-0.5 text-[11px] font-semibold text-white">#{i + 1}</span>
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#344054]">{post.format}</span>
                      </div>
                      <div className="flex flex-col gap-1 p-2">
                        <p className="text-xs font-semibold text-[#101828]">
                          {post.likeCount !== null ? `${int(post.likeCount)} curtidas` : "curtidas ocultas"} · {int(post.commentsCount ?? 0)} coment.
                        </p>
                        <div>
                          <Lift value={post.lift} />
                        </div>
                        <p className="line-clamp-2 text-[11px] text-[#667085]">{post.caption ?? "(sem legenda)"}</p>
                        <p className="text-[11px] text-[#98A2B3]">{post.timestamp.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className={H2}>Temas recorrentes</h2>
                  <p className="mb-3 text-xs text-[#667085]">Assuntos identificados pela primeira linha e pelas palavras que se repetem nas legendas.</p>
                  {current.stats.themes.length === 0 ? (
                    <p className="text-sm text-[#98A2B3]">Não há legendas suficientes para identificar temas.</p>
                  ) : (
                    <div className="flex flex-col">
                      {current.stats.themes.map((theme) => (
                        <div key={theme.name} className="border-t border-[#F2F4F7] py-2.5 first:border-0 first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#101828]">{theme.name} <span className="font-normal text-[#667085]">· {theme.count} posts ({dec(theme.share, 0)}%)</span></p>
                            <span className="flex items-center gap-2 text-xs text-[#667085]">média {int(theme.avgEngagement)} <Lift value={theme.lift} /></span>
                          </div>
                          {theme.examples[0] && <p className="mt-1 line-clamp-1 text-[11px] text-[#98A2B3]">Ex.: “{theme.examples[0]}”</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className={CARD}>
                  <h2 className={H2}>Ganchos que mais rendem</h2>
                  <p className="mb-3 text-xs text-[#667085]">Classificação da primeira linha. A barra compara a média de interações.</p>
                  {current.stats.hooks.length === 0 ? (
                    <p className="text-sm text-[#98A2B3]">Não há legendas suficientes para classificar ganchos.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {current.stats.hooks.map((hook, index) => (
                        <div key={hook.name}>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <p className="font-semibold text-[#101828]">{index + 1}. {hook.name} <span className="font-normal text-[#667085]">· {hook.count} posts</span></p>
                            <span className="flex items-center gap-2 text-xs text-[#667085]">média {int(hook.avgEngagement)} <Lift value={hook.lift} /></span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-[#F2F4F7]">
                            <div className="h-1.5 rounded-full bg-[#FF2B00]" style={{ width: `${Math.max(3, (hook.avgEngagement / maxHookAverage) * 100)}%` }} />
                          </div>
                          {hook.examples[0] && <p className="mt-1 line-clamp-1 text-[11px] text-[#98A2B3]">“{hook.examples[0]}”</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className={H2}>Formatos</h2>
                  <div className="flex flex-col gap-2">
                    {current.stats.formatMix.map((f) => (
                      <div key={f.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[#101828]">
                            {f.name} <span className="font-normal text-[#667085]">· {f.count} posts ({dec(f.share, 0)}%)</span>
                          </span>
                          <span className="flex items-center gap-2 text-xs text-[#667085]">
                            média {int(f.avgEngagement)} <Lift value={current.stats.avgEngagement ? f.avgEngagement / current.stats.avgEngagement : 0} />
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-[#F2F4F7]">
                          <div className="h-2 rounded-full bg-[#FF2B00]" style={{ width: `${f.share}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={CARD}>
                  <h2 className={H2}>Legendas</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Tamanho médio" value={`${int(current.stats.avgCaptionLength)} caracteres`} />
                    <Stat label="Com chamada para ação" value={`${dec(current.stats.ctaShare, 0)}%`} />
                    <Stat label="Com emoji" value={`${dec(current.stats.emojiShare, 0)}%`} />
                    <Stat label="Com pergunta" value={`${dec(current.stats.questionShare, 0)}%`} />
                  </div>
                  <table className="mt-3 w-full">
                    <thead>
                      <tr>
                        <th className={TH}>Tamanho da legenda</th>
                        <th className={TH}>Posts</th>
                        <th className={TH}>Média de interações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.stats.captionLength.map((b) => (
                        <tr key={b.name} className="border-t border-[#F2F4F7]">
                          <td className={TD}>{b.name}</td>
                          <td className={TD}>{b.count}</td>
                          <td className={TD}>{b.count ? int(b.avgEngagement) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>

              <section className={`${CARD} overflow-x-auto`}>
                <h2 className={H2}>Dias e horários em que posta (horário de Brasília)</h2>
                <div className="min-w-[640px]">
                  <div className="ml-16 grid gap-px text-[10px] text-[#98A2B3]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h} className="text-center">
                        {h}
                      </span>
                    ))}
                  </div>
                  {current.stats.heatmap.map((row, d) => (
                    <div key={d} className="mt-px flex items-center">
                      <span className="w-16 shrink-0 text-xs text-[#667085]">{current.stats.days[d]!.day}</span>
                      <div className="grid flex-1 gap-px" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                        {row.map((count, h) => (
                          <div key={h} title={`${current.stats.days[d]!.day}, ${h}h: ${count} post(s)`} className="flex h-6 items-center justify-center rounded-sm text-[10px] font-medium text-white" style={{ backgroundColor: count ? `rgba(255, 43, 0, ${0.25 + 0.75 * (count / maxHeat)})` : "rgba(152, 162, 179, 0.12)" }}>
                            {count || ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[#344054]">Por dia da semana</p>
                    {current.stats.days.map((d) => (
                      <p key={d.day} className="flex justify-between text-xs text-[#475467]">
                        <span>{d.day}</span>
                        <span>
                          {d.count} posts{d.count ? ` · média ${int(d.avgEngagement)}` : ""}
                        </span>
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[#344054]">Horários mais usados</p>
                    {current.stats.mostUsedSlots.map((s) => (
                      <p key={s.day + s.hour} className="flex justify-between text-xs text-[#475467]">
                        <span>
                          {s.day}, {s.hour}h
                        </span>
                        <span>{s.count} posts</span>
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[#344054]">Horários com mais interações</p>
                    {current.stats.bestSlots.length === 0 && <p className="text-xs text-[#98A2B3]">Precisa de ao menos 2 posts no mesmo horário.</p>}
                    {current.stats.bestSlots.map((s) => (
                      <p key={s.day + s.hour} className="flex justify-between text-xs text-[#475467]">
                        <span>
                          {s.day}, {s.hour}h
                        </span>
                        <span>média {int(s.avgEngagement)}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className={H2}>
                    Hashtags{" "}
                    <span className="font-normal text-[#98A2B3]">
                      · em {dec(current.stats.hashtagShare, 0)}% dos posts · {dec(current.stats.hashtagsPerPost)} por post
                    </span>
                  </h2>
                  {current.stats.topHashtags.length === 0 ? (
                    <p className="text-sm text-[#98A2B3]">Não usa hashtags neste período.</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className={TH}>Hashtag</th>
                          <th className={TH}>Usos</th>
                          <th className={TH}>Média de interações</th>
                          <th className={TH} />
                        </tr>
                      </thead>
                      <tbody>
                        {current.stats.topHashtags.map((h) => (
                          <tr key={h.tag} className="border-t border-[#F2F4F7]">
                            <td className={`${TD} break-all`}>{h.tag}</td>
                            <td className={TD}>{h.uses}</td>
                            <td className={TD}>{int(h.avgEngagement)}</td>
                            <td className={TD}>
                              <Lift value={h.lift} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <div className="flex flex-col gap-5">
                  <section className={CARD}>
                    <h2 className={H2}>Chamadas para ação nas legendas</h2>
                    {current.stats.ctas.length === 0 ? (
                      <p className="text-sm text-[#98A2B3]">Nenhuma chamada para ação reconhecida.</p>
                    ) : (
                      current.stats.ctas.map((c) => (
                        <p key={c.name} className="flex items-center justify-between border-t border-[#F2F4F7] py-1.5 text-sm first:border-0">
                          <span className="text-[#101828]">{c.name}</span>
                          <span className="flex items-center gap-2 text-xs text-[#667085]">
                            {c.count} posts <Lift value={c.lift} />
                          </span>
                        </p>
                      ))
                    )}
                  </section>
                  <section className={CARD}>
                    <h2 className={H2}>Palavras mais usadas</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {current.stats.topWords.map((w) => (
                        <span key={w.word} className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs text-[#344054]">
                          {w.word} <span className="text-[#98A2B3]">{w.count}</span>
                        </span>
                      ))}
                      {current.stats.topWords.length === 0 && <p className="text-sm text-[#98A2B3]">Sem repetição suficiente.</p>}
                    </div>
                    {current.stats.topMentions.length > 0 && (
                      <>
                        <p className="mb-1 mt-3 text-xs font-semibold text-[#344054]">Perfis que mais marca</p>
                        <div className="flex flex-wrap gap-1.5">
                          {current.stats.topMentions.map((m) => (
                            <span key={m.name} className="rounded-full bg-[#EFF8FF] px-2 py-0.5 text-xs text-[#175CD3]">
                              {m.name} <span className="opacity-60">{m.count}</span>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
