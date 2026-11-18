import { prisma } from "@zenite-mkt/db";
import { competitorSnapshotDay } from "./competitor-snapshot-day";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

export interface GooglePlaceCandidate { id: string; name: string; address: string }

function key(): string {
  const value = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!value) throw new Error("Configure GOOGLE_PLACES_API_KEY para usar avaliações do Google.");
  return value;
}

async function googleFetch(url: string, init: RequestInit, fieldMask: string) {
  const response = await fetch(url, { ...init, headers: { ...init.headers, "X-Goog-Api-Key": key(), "X-Goog-FieldMask": fieldMask } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "O Google não respondeu à consulta.");
  return body;
}

export async function searchGooglePlaces(query: string): Promise<GooglePlaceCandidate[]> {
  const textQuery = query.trim().slice(0, 160);
  if (textQuery.length < 3) return [];
  const body = await googleFetch(SEARCH_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ textQuery, pageSize: 5, languageCode: "pt-BR", regionCode: "BR", includePureServiceAreaBusinesses: true }),
  }, "places.id,places.displayName,places.formattedAddress");
  return (body.places ?? []).map((place: any) => ({ id: String(place.id), name: String(place.displayName?.text ?? "Estabelecimento"), address: String(place.formattedAddress ?? "") }));
}

export interface GoogleProfileCheck { id: string; label: string; ok: boolean; detail: string }

/** Completude pública do perfil: o que qualquer pessoa vê na ficha do Google. */
function profileChecks(place: any): GoogleProfileCheck[] {
  const photoCount = Array.isArray(place.photos) ? place.photos.length : 0;
  return [
    { id: "category", label: "Categoria definida", ok: Boolean(place.primaryTypeDisplayName?.text), detail: place.primaryTypeDisplayName?.text ?? "Sem categoria principal." },
    { id: "phone", label: "Telefone cadastrado", ok: Boolean(place.nationalPhoneNumber), detail: place.nationalPhoneNumber ?? "Sem telefone." },
    { id: "website", label: "Site cadastrado no perfil", ok: Boolean(place.websiteUri), detail: place.websiteUri ?? "Sem site." },
    { id: "hours", label: "Horário de funcionamento", ok: Boolean(place.regularOpeningHours?.weekdayDescriptions?.length), detail: place.regularOpeningHours?.weekdayDescriptions?.length ? "Cadastrado." : "Não informado." },
    { id: "photos", label: "Fotos no perfil", ok: photoCount >= 3, detail: `${photoCount} foto(s) pública(s).` },
  ];
}

export async function fetchGooglePlace(placeId: string) {
  if (!/^[A-Za-z0-9_-]{8,300}$/.test(placeId)) throw new Error("Local do Google inválido.");
  const place = await googleFetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, { method: "GET" }, "id,displayName,formattedAddress,rating,userRatingCount,primaryTypeDisplayName,nationalPhoneNumber,websiteUri,regularOpeningHours,photos");
  return { id: String(place.id), name: String(place.displayName?.text ?? "Estabelecimento"), address: String(place.formattedAddress ?? ""), rating: typeof place.rating === "number" ? place.rating : null, reviewCount: Number.isInteger(place.userRatingCount) ? place.userRatingCount : null, profileChecks: profileChecks(place) };
}

export async function linkGooglePlace(competitorId: string, placeId: string) {
  const place = await fetchGooglePlace(placeId);
  const now = new Date();
  const day = competitorSnapshotDay(now);
  await prisma.$transaction([
    prisma.competitorGoogleSnapshot.deleteMany({ where: { competitorId } }),
    prisma.competitor.update({ where: { id: competitorId }, data: { googlePlaceId: place.id, googlePlaceName: place.name, googlePlaceAddress: place.address, googleRating: place.rating, googleReviewCount: place.reviewCount, googleProfileChecks: place.profileChecks as never, googleLastSyncAt: now, googleLastError: null } }),
    prisma.competitorGoogleSnapshot.create({ data: { competitorId, day, rating: place.rating, reviewCount: place.reviewCount } }),
  ]);
  return place;
}

export async function syncGooglePlace(competitorId: string) {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId }, select: { googlePlaceId: true } });
  if (!competitor?.googlePlaceId) throw new Error("Vincule um estabelecimento do Google primeiro.");
  try {
    const place = await fetchGooglePlace(competitor.googlePlaceId);
    const now = new Date();
    await prisma.$transaction([
      prisma.competitor.update({ where: { id: competitorId }, data: { googlePlaceName: place.name, googlePlaceAddress: place.address, googleRating: place.rating, googleReviewCount: place.reviewCount, googleProfileChecks: place.profileChecks as never, googleLastSyncAt: now, googleLastError: null } }),
      prisma.competitorGoogleSnapshot.upsert({ where: { competitorId_day: { competitorId, day: competitorSnapshotDay(now) } }, create: { competitorId, day: competitorSnapshotDay(now), rating: place.rating, reviewCount: place.reviewCount }, update: { rating: place.rating, reviewCount: place.reviewCount } }),
    ]);
    return place;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Falha ao atualizar o Google.";
    await prisma.competitor.update({ where: { id: competitorId }, data: { googleLastError: message } });
    throw error;
  }
}

export async function syncAllGooglePlaces(budgetMs = 50_000) {
  const started = Date.now();
  const rows = await prisma.competitor.findMany({ where: { googlePlaceId: { not: null } }, orderBy: { googleLastSyncAt: { sort: "asc", nulls: "first" } }, select: { id: true } });
  let updated = 0, failed = 0;
  for (const row of rows) {
    if (Date.now() - started > budgetMs) break;
    try { await syncGooglePlace(row.id); updated += 1; } catch { failed += 1; }
  }
  return { found: rows.length, updated, failed };
}
