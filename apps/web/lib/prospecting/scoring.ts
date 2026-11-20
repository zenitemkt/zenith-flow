import { normalizePhone } from "@/lib/lead-contact";

/** Item devolvido pelo Google Maps Scraper do Apify (só os campos que usamos). */
export interface ApifyPlace {
  title?: string;
  placeId?: string | null;
  phone?: string | null;
  phoneUnformatted?: string | null;
  email?: string | null;
  emails?: string[] | null;
  website?: string | null;
  address?: string | null;
  categoryName?: string | null;
  url?: string | null;
  totalScore?: number | null;
  reviewsCount?: number | null;
  imageUrls?: unknown[] | null;
  imagesCount?: number | null;
  openingHours?: unknown[] | null;
  permanentlyClosed?: boolean | null;
}

export type Temperature = "QUENTE" | "MORNO" | "FRIO";

/** Telefone brasileiro válido (55 + DDD + número), ou null. */
export function prospectPhone(place: ApifyPlace): string | null {
  const digits = normalizePhone(place.phoneUnformatted || place.phone);
  return digits && digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits : null;
}

export function prospectEmail(place: ApifyPlace): string | null {
  const raw = place.email || place.emails?.[0] || null;
  const email = raw?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

const hasWebsite = (place: ApifyPlace) => Boolean(place.website && !["", "n/a"].includes(place.website.trim().toLowerCase()));

/**
 * Pontuação de 0 a 10 (mesmos critérios do pacote do curso): quem tem como ser contatado e mais
 * precisa de marketing pontua mais. Sem site e nota abaixo de 4,5 indicam espaço pra crescer online;
 * muitas avaliações, fotos e horário cadastrado indicam negócio ativo e estabelecido.
 */
export function scoreProspect(place: ApifyPlace): { score: number; temperature: Temperature; potential: string } {
  let score = 0;
  if (prospectPhone(place)) score += 2;
  if (prospectEmail(place)) score += 1;
  if (!hasWebsite(place)) score += 2;
  const rating = place.totalScore ?? null;
  if (rating !== null) {
    if (rating < 4.5) score += 1;
    if (rating >= 4) score += 1;
  }
  const reviews = place.reviewsCount ?? 0;
  if (reviews > 50) score += 1;
  if ((place.imageUrls?.length ?? 0) > 0 || (place.imagesCount ?? 0) > 0) score += 1;
  if ((place.openingHours?.length ?? 0) > 0) score += 1;
  score = Math.min(10, score);

  const points: string[] = [];
  if (!hasWebsite(place)) points.push("Sem site próprio");
  if (rating !== null && rating < 4.5) points.push("espaço para crescer online");
  if (reviews > 50) points.push("negócio estabelecido com demanda");
  if (prospectPhone(place)) points.push("telefone disponível");

  return { score, temperature: score >= 8 ? "QUENTE" : score >= 5 ? "MORNO" : "FRIO", potential: points.join(", ") || "perfil padrão" };
}
