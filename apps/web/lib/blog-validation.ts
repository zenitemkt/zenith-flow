/**
 * Validação mecânica do artigo de blog — zero IA, só regex/contagem, mesmo
 * espírito de `tools/check-service-copy.mjs` no repo do Zenite Hub (e a
 * mesma lista de "vícios de escrita" de lá, replicada aqui porque são dois
 * repositórios separados sem pacote compartilhado). Roda antes de qualquer
 * commit — nada é publicado sem passar aqui (seção 2.3 do Blueprint de
 * Automações, adaptada: a exigência de "fonte científica/PubMed" do
 * blueprint original era específica do nicho dele e não se aplica ao blog
 * de marketing do Zenite Hub, então foi substituída pela checagem de link
 * interno no formato real do site, `[texto](@slug)`).
 */

export const VALID_BLOG_CATEGORIES = ["Marketing Digital", "SEO", "Tráfego Pago", "Vendas"] as const;

/** As 12 chaves de arte SVG já existentes em `tools/generate-blog.mjs` (zenitehub) — nenhuma imagem nova é gerada, só reaproveitada. */
export const VALID_COVER_KEYS = [
  "seo",
  "indexacao",
  "inbound",
  "assessoria",
  "cpl",
  "whatsapp",
  "ads",
  "local",
  "landing",
  "rapido",
  "remarketing",
  "alternativas",
] as const;

export interface BlogDraftValidationInput {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  seoTitle?: string | null;
  focusKeyword?: string | null;
  category?: string | null;
  cover?: string | null;
  /** Slugs de artigos já publicados — pra checar link interno e evitar repetir slug. */
  existingSlugs: string[];
  /** true quando `origin === "refresh"` — inverte a regra de slug: exige que já exista, em vez de proibir. */
  isRefresh?: boolean;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

/** Mesma lista de `tools/check-service-copy.mjs` do zenitehub — mantenha as duas em sincronia. */
const BANNED_PATTERNS: Array<[RegExp, string]> = [
  [/—|–/, "travessão"],
  [/;/, "ponto e vírgula"],
  [/além disso|por outro lado|por fim|ou seja|portanto|no entanto/i, "conector previsível"],
  [/é importante|vale ressaltar|vale destacar/i, "muleta"],
  [
    /fascinante|incrível|essencial|crucial|poderos[oa]|revolucion|alavanc|potencializ|mergulh|desbloque|melhor agência|garantid[oa]s?\b/i,
    "adjetivo vazio ou promessa",
  ],
  [/jornada de transformação|transformação digital|ecossistema/i, "vocabulário vago"],
  [/não (é|são) (apenas|só|somente|simplesmente)/i, 'estrutura "não é apenas X"'],
  [/[Nn]ão (é|são)[^.!?\n]{0,70}, (é|são|mas)(?=\s)/, 'estrutura "não é X, é Y"'],
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateBlogDraft(input: BlogDraftValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (field: string, message: string) => issues.push({ field, message });

  const slug = input.slug.trim();
  if (!slug) push("slug", "slug vazio");
  else if (!SLUG_PATTERN.test(slug)) push("slug", "slug precisa ser minúsculo, só letras/números separados por hífen");

  if (!input.title.trim()) push("title", "título vazio");
  if (!input.content.trim()) push("content", "conteúdo vazio");

  const category = (input.category ?? "").trim();
  if (!category) push("category", "category ausente");
  else if (!(VALID_BLOG_CATEGORIES as readonly string[]).includes(category)) {
    push("category", `category "${category}" inválida — use uma de: ${VALID_BLOG_CATEGORIES.join(", ")}`);
  }

  const cover = (input.cover ?? "").trim();
  if (!cover) push("cover", "cover ausente");
  else if (!(VALID_COVER_KEYS as readonly string[]).includes(cover)) {
    push("cover", `cover "${cover}" inválida — use uma de: ${VALID_COVER_KEYS.join(", ")}`);
  }

  const seoTitle = (input.seoTitle ?? "").trim();
  if (!seoTitle) {
    push("seoTitle", "seoTitle ausente");
  } else {
    if (seoTitle.length < 30 || seoTitle.length > 60) {
      push("seoTitle", `seoTitle com ${seoTitle.length} caracteres (esperado 30–60)`);
    }
    if (/—|–/.test(seoTitle)) push("seoTitle", "seoTitle não pode conter travessão");
    if (input.focusKeyword && !seoTitle.toLowerCase().includes(input.focusKeyword.trim().toLowerCase())) {
      push("seoTitle", "seoTitle precisa conter a focusKeyword");
    }
  }

  const excerpt = (input.excerpt ?? "").trim();
  if (!excerpt) {
    push("excerpt", "excerpt ausente");
  } else {
    if (excerpt.length < 70 || excerpt.length > 160) {
      push("excerpt", `excerpt com ${excerpt.length} caracteres (esperado 70–160)`);
    }
    if (!/^[A-ZÀ-Ý]/.test(excerpt)) push("excerpt", "excerpt precisa começar com letra maiúscula");
    if (/^revis[ãa]o[:\s]/i.test(excerpt)) push("excerpt", 'excerpt não pode começar com rótulo tipo "REVISÃO:"');
  }

  const focusKeyword = (input.focusKeyword ?? "").trim();
  if (!focusKeyword) {
    push("focusKeyword", "focusKeyword ausente");
  } else {
    const words = wordCount(focusKeyword);
    if (words < 2 || words > 5) push("focusKeyword", `focusKeyword com ${words} palavra(s) (esperado 2–5)`);

    const paragraphs = input.content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !p.startsWith("#") && !p.startsWith(":::"));
    const firstTwo = paragraphs.slice(0, 2).join(" ").toLowerCase();
    if (!firstTwo.includes(focusKeyword.toLowerCase())) {
      push("focusKeyword", "focusKeyword precisa aparecer nos 2 primeiros parágrafos");
    }

    const hasSubheading = input.content
      .split("\n")
      .some((line) => /^##\s/.test(line) && line.toLowerCase().includes(focusKeyword.toLowerCase()));
    if (!hasSubheading) push("focusKeyword", "focusKeyword precisa aparecer em pelo menos um subtítulo ##");
  }

  // Link interno — formato real do site: [texto](@slug). Mesma checagem que
  // generate-blog.mjs faz na hora de gerar (lá ela lança erro; aqui devolvemos
  // a violação antes de chegar nesse ponto).
  const internalLinks = [...input.content.matchAll(/\]\(@([a-z0-9-]+)\)/g)]
    .map((m) => m[1])
    .filter((value): value is string => Boolean(value));
  if (internalLinks.length === 0) {
    push("content", "falta link interno no formato [texto](@slug) — linke todo artigo existente com conexão temática real (seção 7.1 das regras)");
  }
  for (const linkedSlug of internalLinks) {
    if (linkedSlug === slug) push("content", `link interno aponta pro próprio artigo (@${linkedSlug})`);
    else if (!input.existingSlugs.includes(linkedSlug)) push("content", `link interno pra slug inexistente: @${linkedSlug}`);
  }

  if (slug) {
    const slugExists = input.existingSlugs.includes(slug);
    if (input.isRefresh && !slugExists) {
      push("slug", 'origin "refresh" exige um slug de artigo que já existe — pra artigo novo, use origin "manual" ou "search_console"');
    } else if (!input.isRefresh && slugExists) {
      push("slug", "slug já existe — use o fluxo de revisão (origin: refresh) em vez de criar um novo rascunho");
    }
  }

  // Rodapé de referências (política de pesquisa, 2026-10-15) — checa só a
  // presença mecânica da seção e um mínimo de links reais; não dá pra
  // validar aqui se as fontes realmente existem/foram consultadas, isso é
  // responsabilidade do agente (seção 4 do agent-rules).
  const referencesMatch = input.content.match(/##\s*Referências e fontes consultadas\s*\n([\s\S]*)$/i);
  if (!referencesMatch) {
    push("content", 'falta a seção final "## Referências e fontes consultadas"');
  } else {
    const referenceLines = referencesMatch[1]!
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^-\s*\[.+\]\(https?:\/\/[^)]+\)/.test(l));
    if (referenceLines.length < 3) {
      push("content", `seção de referências com ${referenceLines.length} link(s) — esperado pelo menos 3, formato "- [Título](URL) — Instituição, Ano"`);
    }
  }

  // Abertura de parágrafo repetida em relação aos últimos artigos — fica a
  // cargo do chamador (precisa do corpo dos últimos N artigos publicados,
  // que este módulo não busca sozinho).

  // O rodapé de referências é excluído daqui: o formato exigido pela seção 8
  // ("- [Título](URL) — Instituição, Ano") usa travessão de propósito, e essa
  // seção já tem checagem própria logo acima.
  const bodyWithoutReferences = referencesMatch ? input.content.slice(0, referencesMatch.index ?? input.content.length) : input.content;
  const lines = bodyWithoutReferences.split("\n");
  const seenLines = new Set<string>();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    for (const [pattern, label] of BANNED_PATTERNS) {
      const match = line.match(pattern);
      if (match) push("content", `${label}: "${match[0]}" em "${line.slice(0, 80)}"`);
    }
    if (line.length > 20 && seenLines.has(line)) {
      push("content", `linha repetida dentro do próprio artigo: "${line.slice(0, 60)}"`);
    }
    seenLines.add(line);
  }

  return issues;
}

/** Checa se a abertura do artigo (primeiras ~12 palavras do primeiro parágrafo) repete a dos últimos artigos publicados. */
export function checkRepeatedOpening(content: string, recentOpenings: string[]): ValidationIssue[] {
  const firstParagraph = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith("#") && !p.startsWith(":::"));
  if (!firstParagraph) return [];
  const opening = firstParagraph.split(/\s+/).slice(0, 12).join(" ").toLowerCase();
  const normalizedOpening = opening.replace(/[^a-zà-ÿ0-9\s]/gi, "");
  for (const recent of recentOpenings) {
    const normalizedRecent = recent.split(/\s+/).slice(0, 12).join(" ").toLowerCase().replace(/[^a-zà-ÿ0-9\s]/gi, "");
    if (normalizedOpening && normalizedOpening === normalizedRecent) {
      return [{ field: "content", message: "abertura do artigo igual à de um artigo publicado recentemente" }];
    }
  }
  return [];
}

export { escapeRegExp };
