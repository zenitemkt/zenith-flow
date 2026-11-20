import type { ApifyPlace } from "./scoring";

/** Google Maps Scraper (compass/crawler-google-places) — o mesmo robô do pacote do curso. */
const ACTOR_ID = "nwua9Gu5YrADL7ZDj";
const API = "https://api.apify.com/v2";

export interface ApifyRunRef {
  runId: string;
  segment: string;
  city: string;
  startedAt: string;
}

async function apify<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(response.status === 401 ? "Chave do Apify inválida." : `Apify: ${message}`);
  }
  return data as T;
}

/** Dispara a busca no Google Maps (assíncrona: o robô leva alguns minutos). */
export async function startPlacesRun(token: string, segment: string, city: string, limit: number): Promise<ApifyRunRef> {
  const result = await apify<{ data: { id: string } }>(token, `/acts/${ACTOR_ID}/runs`, {
    method: "POST",
    body: JSON.stringify({ searchStringsArray: [`${segment} em ${city}`], maxCrawledPlacesPerSearch: limit, language: "pt-BR", countryCode: "br" }),
  });
  return { runId: result.data.id, segment, city, startedAt: new Date().toISOString() };
}

export type RunState = { status: "running" } | { status: "done"; datasetId: string } | { status: "failed"; reason: string };

export async function getRunState(token: string, runId: string): Promise<RunState> {
  const result = await apify<{ data: { status: string; defaultDatasetId: string } }>(token, `/actor-runs/${encodeURIComponent(runId)}`);
  const { status, defaultDatasetId } = result.data;
  if (status === "SUCCEEDED") return { status: "done", datasetId: defaultDatasetId };
  if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) return { status: "failed", reason: status };
  return { status: "running" };
}

export function fetchPlaces(token: string, datasetId: string): Promise<ApifyPlace[]> {
  return apify<ApifyPlace[]>(token, `/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true`);
}
