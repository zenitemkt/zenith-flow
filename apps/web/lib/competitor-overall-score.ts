/**
 * Nota geral (0-100) de um perfil, cruzando os canais disponíveis. É uma estimativa: usa só o
 * que está medido (perfil sem Google ou sem site não é penalizado por isso) e cada canal tem o
 * mesmo peso quando presente.
 */
export interface OverallScoreInput {
  instagramEngagementRate: number | null; // % (curtidas+comentários / seguidores) por post
  googleRating: number | null; // 0-5
  websiteScore: number | null; // 0-100 (PageSpeed, performance)
  websiteSeoScore: number | null; // 0-100 (PageSpeed, SEO)
}

export interface OverallScoreResult {
  score: number | null;
  parts: { label: string; value: number }[];
  missing: string[];
}

/** 4% de engajamento já é ótimo para a maioria dos nichos: vira teto de 100 pontos. */
const ENGAGEMENT_TARGET = 4;

export function computeOverallScore(input: OverallScoreInput): OverallScoreResult {
  const parts: { label: string; value: number }[] = [];
  const missing: string[] = [];

  if (input.instagramEngagementRate !== null) parts.push({ label: "Instagram", value: Math.min(100, (input.instagramEngagementRate / ENGAGEMENT_TARGET) * 100) });
  else missing.push("Instagram");

  if (input.googleRating !== null) parts.push({ label: "Google", value: (input.googleRating / 5) * 100 });
  else missing.push("Google");

  if (input.websiteScore !== null) parts.push({ label: "Velocidade do site", value: input.websiteScore });
  else missing.push("Velocidade do site");

  if (input.websiteSeoScore !== null) parts.push({ label: "SEO do site", value: input.websiteSeoScore });
  else missing.push("SEO do site");

  if (parts.length === 0) return { score: null, parts, missing };
  const score = Math.round(parts.reduce((total, part) => total + part.value, 0) / parts.length);
  return { score, parts, missing };
}
