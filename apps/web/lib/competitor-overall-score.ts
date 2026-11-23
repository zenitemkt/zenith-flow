/**
 * Nota geral (0-100) de um perfil, cruzando os canais disponíveis. É uma estimativa: cada canal
 * vira uma nota de 0-100 e a nota geral é a média dos canais presentes.
 *
 * "Presente" != "com avaliação boa": um perfil com Google Meu Negócio vinculado mas sem nenhuma
 * avaliação conta sim no cálculo (e conta mal — falta de avaliação é falta de prova social, não
 * dado ausente). Só fica de fora quando o canal nem existe pro perfil (sem Google vinculado, por
 * exemplo) — aí não há nota nenhuma pra puxar pra baixo ou pra cima.
 *
 * Zero avaliações pontua 0 de verdade, não uma nota mediana: não ter nenhuma prova social é o
 * pior caso, não um caso incerto. Com pelo menos 1 avaliação mas poucas, a nota usa "shrinkage":
 * é puxada em direção a um piso conservador quando a amostra (nº de avaliações, nº de posts) é
 * pequena, e só vale como está quando a amostra já é grande o bastante pra confiar nela. Isso
 * evita que 1 avaliação de 5 estrelas valha mais que 100 avaliações de 4,9 — a segunda tem muito
 * mais prova social e deve pontuar mais alto.
 */
export interface OverallScoreInput {
  /** null = perfil do Instagram nunca sincronizado (sem seguidores registrados) — aí sim fica de fora. */
  instagram: { engagementRate: number | null; postCount: number } | null;
  google: {
    /** sem placeId = sem Google Meu Negócio vinculado — fica de fora do cálculo. */
    placeId: string | null;
    rating: number | null;
    reviewCount: number | null;
    profileChecks: { ok: boolean }[] | null;
  };
  websiteScore: number | null;
  websiteSeoScore: number | null;
}

export interface OverallScoreResult {
  score: number | null;
  parts: { label: string; value: number }[];
  missing: string[];
}

/** 4% de engajamento já é ótimo para a maioria dos nichos: vira teto de 100 pontos. */
const ENGAGEMENT_TARGET = 4;
/** Nº de posts no período a partir do qual a taxa de engajamento já é confiável. */
const ENGAGEMENT_CONFIDENCE_POSTS = 6;
/** Sem posts no período, a taxa "real" conta como 0 (sem prova de engajamento) — não null. */
const ENGAGEMENT_FLOOR = 0;

/** Nº de avaliações do Google a partir do qual a média já é confiável. */
const GOOGLE_CONFIDENCE_REVIEWS = 10;
/** Com pelo menos 1 avaliação mas poucas, a nota puxa pra essa mediana baixa em vez de valer cheia. */
const GOOGLE_RATING_FLOOR = 3;
/** Zero avaliações não é "pouca prova social", é nenhuma: nota 0 de verdade, não o piso de quem tem 1 ou 2. */
const GOOGLE_NO_REVIEWS_SCORE = 0;
/** Peso da nota (estrelas) vs. completude do perfil (categoria, telefone, site, horário, fotos) na nota final do Google. */
const GOOGLE_RATING_WEIGHT = 0.8;

/** Puxa `value` em direção a `floor` quando `sampleSize` é pequeno perto de `confidenceSize`; com amostra grande, `value` vale quase integralmente. */
function shrinkToward(value: number, sampleSize: number, confidenceSize: number, floor: number): number {
  return (confidenceSize * floor + sampleSize * value) / (confidenceSize + sampleSize);
}

export function computeOverallScore(input: OverallScoreInput): OverallScoreResult {
  const parts: { label: string; value: number }[] = [];
  const missing: string[] = [];

  if (input.instagram) {
    const effectiveRate = shrinkToward(input.instagram.engagementRate ?? 0, input.instagram.postCount, ENGAGEMENT_CONFIDENCE_POSTS, ENGAGEMENT_FLOOR);
    parts.push({ label: "Instagram", value: Math.min(100, (effectiveRate / ENGAGEMENT_TARGET) * 100) });
  } else missing.push("Instagram");

  if (input.google.placeId) {
    const reviewCount = input.google.reviewCount ?? 0;
    const ratingScore = reviewCount === 0 ? GOOGLE_NO_REVIEWS_SCORE : (shrinkToward(input.google.rating ?? 0, reviewCount, GOOGLE_CONFIDENCE_REVIEWS, GOOGLE_RATING_FLOOR) / 5) * 100;
    const checks = input.google.profileChecks ?? [];
    const completenessScore = checks.length > 0 ? (checks.filter((c) => c.ok).length / checks.length) * 100 : 100;
    parts.push({ label: "Google", value: ratingScore * GOOGLE_RATING_WEIGHT + completenessScore * (1 - GOOGLE_RATING_WEIGHT) });
  } else missing.push("Google");

  if (input.websiteScore !== null) parts.push({ label: "Velocidade do site", value: input.websiteScore });
  else missing.push("Velocidade do site");

  if (input.websiteSeoScore !== null) parts.push({ label: "SEO do site", value: input.websiteSeoScore });
  else missing.push("SEO do site");

  if (parts.length === 0) return { score: null, parts, missing };
  const score = Math.round(parts.reduce((total, part) => total + part.value, 0) / parts.length);
  return { score, parts, missing };
}
