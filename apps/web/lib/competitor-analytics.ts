/** Análise de concorrentes: contas puras sobre os posts públicos do Instagram (sem banco, sem API). */

export interface AnalyticsPost {
  id: string;
  timestamp: Date;
  caption: string | null;
  mediaType: string;
  mediaProductType: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  permalink: string | null;
  thumbnailUrl: string | null;
}

export const formatOf = (p: Pick<AnalyticsPost, "mediaType" | "mediaProductType">) =>
  p.mediaProductType === "REELS" ? "Reels" : p.mediaType === "CAROUSEL_ALBUM" ? "Carrossel" : p.mediaType === "VIDEO" ? "Vídeo" : "Imagem";

export const engagementOf = (p: Pick<AnalyticsPost, "likeCount" | "commentsCount">) => (p.likeCount ?? 0) + (p.commentsCount ?? 0);

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const STOPWORDS = new Set(
  "a o as os um uma uns umas de da do das dos em no na nos nas por para pra pro com sem que e ou se mas mais como seu sua seus suas meu minha nosso nossa você voce vocês te ti nós eles elas ele ela isso isto esse essa este esta aqui ali lá já não nao sim é ser são foi tem têm ter vai vão ao à às aos pelo pela muito muita também tambem só so até ate sobre entre quando onde quem qual cada todo toda todos todas the and for with nos nas seu são está estão estar faz fazer feito pode podem hoje agora ainda bem tudo nada".split(
    " ",
  ),
);
const CTAS: [string, RegExp][] = [
  ["Link na bio", /link (na|da) bio/i],
  ["Chamar no WhatsApp", /whats|wpp|zap\b/i],
  ["Comentar", /coment(e|a|em)\b|deixe (seu|um) coment/i],
  ["Agendar", /agend(e|ar|amento)/i],
  ["Compartilhar", /compartilh(e|a|ar)|envi(e|a) para|mand(e|a) (para|pra)/i],
  ["Salvar", /salv(e|a|ar) (esse|este|o) (post|v[ií]deo|conte[uú]do)|j[aá] salva/i],
  ["Mandar direct", /direct|\bdm\b|chama no (privado|inbox)/i],
  ["Clicar ou acessar", /cliqu?e|acess(e|ar)|saiba mais|garanta/i],
  ["Seguir o perfil", /segu(e|ir|a) (a gente|o perfil|n[oó]s|para)|ativ(e|a) (as )?notifica/i],
];

export type HookType = "Pergunta" | "Número" | "Promessa" | "Erro ou alerta" | "Prova social" | "Oferta" | "Outro";

const firstLineOf = (caption: string | null) => (caption ?? "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";

/** Classifica a abertura da legenda com regras simples e explicáveis. */
export function classifyHook(caption: string | null): HookType {
  const line = firstLineOf(caption);
  if (!line) return "Outro";
  if (line.includes("?")) return "Pergunta";
  if (/^\s*(?:[\p{Extended_Pictographic}\s]+)?\d+\b/u.test(line)) return "Número";
  const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(pare de|erros?|evite|nunca faca|cuidado|nao faca)\b/.test(normalized)) return "Erro ou alerta";
  if (/\b(depoimento|case|caso real|antes e depois|cliente[s]?|resultado[s]?)\b|\d+\s*%/.test(normalized)) return "Prova social";
  if (/\b(oferta|promocao|desconto|condicao especial|ultimas vagas|vagas abertas|compre|contrate)\b/.test(normalized)) return "Oferta";
  if (/\b(como|aprenda|descubra|saiba|transforme|aumente|melhore|conquiste|alcance)\b/.test(normalized)) return "Promessa";
  return "Outro";
}

function meaningfulWords(text: string): string[] {
  const clean = text.replace(/[#@][\p{L}\p{N}_.]+/gu, " ").replace(/https?:\S+/g, " ").toLowerCase();
  return (clean.match(/[\p{L}]{4,}/gu) ?? []).filter((word) => !STOPWORDS.has(word));
}

function capitalize(value: string): string {
  return value ? value[0]!.toLocaleUpperCase("pt-BR") + value.slice(1) : value;
}

/** Hora e dia em Brasília (UTC-3). */
const sp = (d: Date) => new Date(d.getTime() - 3 * 3600_000);
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

export function analyzeCompetitor(posts: AnalyticsPost[], followers: number | null, periodDays: number) {
  const list = [...posts].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const meanEng = avg(list.map(engagementOf));
  const rate = (eng: number) => (followers && followers > 0 ? (eng / followers) * 100 : null);

  // Formatos
  const formats = new Map<string, number[]>();
  for (const p of list) (formats.get(formatOf(p)) ?? formats.set(formatOf(p), []).get(formatOf(p))!).push(engagementOf(p));
  const formatMix = Array.from(formats, ([name, e]) => ({ name, count: e.length, share: (e.length / list.length) * 100, avgEngagement: avg(e) })).sort((a, b) => b.count - a.count);

  // Hashtags, menções, palavras, CTAs
  const hashtags = new Map<string, number[]>();
  const mentions = new Map<string, number>();
  const words = new Map<string, number>();
  const ctas = new Map<string, number[]>();
  let withHashtag = 0;
  let hashtagTotal = 0;
  let withCta = 0;
  let withEmoji = 0;
  let withQuestion = 0;
  const captionLengths: number[] = [];
  const lengthBuckets: Record<"Curta (até 150)" | "Média (150 a 600)" | "Longa (600+)", number[]> = { "Curta (até 150)": [], "Média (150 a 600)": [], "Longa (600+)": [] };
  for (const p of list) {
    const text = p.caption ?? "";
    const eng = engagementOf(p);
    captionLengths.push(text.length);
    lengthBuckets[text.length <= 150 ? "Curta (até 150)" : text.length <= 600 ? "Média (150 a 600)" : "Longa (600+)"].push(eng);
    const tags = Array.from(new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase())));
    if (tags.length) withHashtag += 1;
    hashtagTotal += tags.length;
    for (const tag of tags) (hashtags.get(tag) ?? hashtags.set(tag, []).get(tag)!).push(eng);
    for (const m of new Set((text.match(/@[A-Za-z0-9._]{2,30}/g) ?? []).map((t) => t.toLowerCase()))) mentions.set(m, (mentions.get(m) ?? 0) + 1);
    const clean = text.replace(/[#@][\p{L}\p{N}_.]+/gu, " ").replace(/https?:\S+/g, " ").toLowerCase();
    for (const w of new Set(clean.match(/[\p{L}]{4,}/gu) ?? [])) if (!STOPWORDS.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
    let hasCta = false;
    for (const [name, re] of CTAS) {
      if (re.test(text)) {
        hasCta = true;
        (ctas.get(name) ?? ctas.set(name, []).get(name)!).push(eng);
      }
    }
    if (hasCta) withCta += 1;
    if (/\p{Extended_Pictographic}/u.test(text)) withEmoji += 1;
    if (text.includes("?")) withQuestion += 1;
  }
  const lift = (value: number) => (meanEng > 0 ? value / meanEng : 0);
  const topHashtags = Array.from(hashtags, ([tag, e]) => ({ tag, uses: e.length, avgEngagement: avg(e), lift: lift(avg(e)) }))
    .sort((a, b) => b.uses - a.uses || b.avgEngagement - a.avgEngagement)
    .slice(0, 20);

  // Temas recorrentes: uma palavra recorrente da primeira linha representa o assunto do post.
  const recurringWords = new Map<string, number>();
  for (const post of list) {
    for (const word of new Set(meaningfulWords(post.caption ?? ""))) recurringWords.set(word, (recurringWords.get(word) ?? 0) + 1);
  }
  const themeGroups = new Map<string, { engagements: number[]; examples: string[] }>();
  const hookGroups = new Map<HookType, { engagements: number[]; examples: string[] }>();
  for (const post of list) {
    const firstLine = firstLineOf(post.caption);
    const lineWords = meaningfulWords(firstLine);
    const recurring = lineWords
      .map((word, position) => ({ word, position, frequency: recurringWords.get(word) ?? 0 }))
      .filter((item) => item.frequency >= 2)
      .sort((a, b) => b.frequency - a.frequency || a.position - b.position)[0]?.word;
    const theme = recurring ? capitalize(recurring) : "Outros";
    const themeEntry = themeGroups.get(theme) ?? { engagements: [], examples: [] };
    themeEntry.engagements.push(engagementOf(post));
    if (firstLine && themeEntry.examples.length < 2) themeEntry.examples.push(firstLine.slice(0, 120));
    themeGroups.set(theme, themeEntry);

    const hook = classifyHook(post.caption);
    const hookEntry = hookGroups.get(hook) ?? { engagements: [], examples: [] };
    hookEntry.engagements.push(engagementOf(post));
    if (firstLine && hookEntry.examples.length < 2) hookEntry.examples.push(firstLine.slice(0, 120));
    hookGroups.set(hook, hookEntry);
  }
  const themes = Array.from(themeGroups, ([name, group]) => ({
    name,
    count: group.engagements.length,
    share: list.length ? (group.engagements.length / list.length) * 100 : 0,
    avgEngagement: avg(group.engagements),
    lift: lift(avg(group.engagements)),
    examples: group.examples,
  })).sort((a, b) => (a.name === "Outros" ? 1 : b.name === "Outros" ? -1 : b.count - a.count || b.avgEngagement - a.avgEngagement));
  const hooks = Array.from(hookGroups, ([name, group]) => ({
    name,
    count: group.engagements.length,
    share: list.length ? (group.engagements.length / list.length) * 100 : 0,
    avgEngagement: avg(group.engagements),
    lift: lift(avg(group.engagements)),
    examples: group.examples,
  })).sort((a, b) => b.avgEngagement - a.avgEngagement || b.count - a.count);

  // Dias e horários (Brasília)
  const byDay = Array.from({ length: 7 }, () => [] as number[]);
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => [] as number[]));
  for (const p of list) {
    const d = sp(p.timestamp);
    byDay[d.getUTCDay()]!.push(engagementOf(p));
    grid[d.getUTCDay()]![d.getUTCHours()]!.push(engagementOf(p));
  }
  const days = byDay.map((e, i) => ({ day: WEEKDAYS[i]!, count: e.length, avgEngagement: avg(e) }));
  const slots = grid.flatMap((row, d) => row.map((e, h) => ({ day: WEEKDAYS[d]!, hour: h, count: e.length, avgEngagement: avg(e) }))).filter((s) => s.count > 0);
  const mostUsedSlots = [...slots].sort((a, b) => b.count - a.count || b.avgEngagement - a.avgEngagement).slice(0, 5);
  const bestSlots = [...slots].filter((s) => s.count >= 2).sort((a, b) => b.avgEngagement - a.avgEngagement).slice(0, 5);
  const heatmap = grid.map((row) => row.map((e) => e.length));

  // Cadência
  const gaps: number[] = [];
  for (let i = 1; i < list.length; i++) gaps.push((list[i]!.timestamp.getTime() - list[i - 1]!.timestamp.getTime()) / 86_400_000);

  const top = [...list].sort((a, b) => engagementOf(b) - engagementOf(a)).slice(0, 12).map((p) => ({ ...p, engagement: engagementOf(p), lift: lift(engagementOf(p)), format: formatOf(p) }));

  return {
    posts: list.length,
    postsPerWeek: list.length / (periodDays / 7),
    avgLikes: avg(list.map((p) => p.likeCount ?? 0)),
    avgComments: avg(list.map((p) => p.commentsCount ?? 0)),
    avgEngagement: meanEng,
    engagementRate: rate(meanEng),
    hiddenLikes: list.filter((p) => p.likeCount === null).length,
    formatMix,
    topHashtags,
    themes,
    hooks,
    hashtagShare: list.length ? (withHashtag / list.length) * 100 : 0,
    hashtagsPerPost: list.length ? hashtagTotal / list.length : 0,
    topMentions: Array.from(mentions, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    topWords: Array.from(words, ([word, count]) => ({ word, count })).filter((w) => w.count >= 2).sort((a, b) => b.count - a.count).slice(0, 20),
    ctas: Array.from(ctas, ([name, e]) => ({ name, count: e.length, avgEngagement: avg(e), lift: lift(avg(e)) })).sort((a, b) => b.count - a.count),
    ctaShare: list.length ? (withCta / list.length) * 100 : 0,
    emojiShare: list.length ? (withEmoji / list.length) * 100 : 0,
    questionShare: list.length ? (withQuestion / list.length) * 100 : 0,
    avgCaptionLength: avg(captionLengths),
    captionLength: Object.entries(lengthBuckets).map(([name, e]) => ({ name, count: e.length, avgEngagement: avg(e) })),
    days,
    heatmap,
    mostUsedSlots,
    bestSlots,
    avgGapDays: avg(gaps),
    longestGapDays: gaps.length ? Math.max(...gaps) : 0,
    top,
  };
}

export type CompetitorAnalytics = ReturnType<typeof analyzeCompetitor>;
