import type { TrackingConsentCategory } from "@zenith/db";

export const TRACKING_CONSENT_CATEGORIES: TrackingConsentCategory[] = [
  "ESSENCIAL",
  "ANALYTICS",
  "MARKETING",
  "PERSONALIZACAO",
];

export const TRACKING_CONSENT_CATEGORY_LABELS: Record<TrackingConsentCategory, string> = {
  ESSENCIAL: "Essencial",
  ANALYTICS: "Analytics",
  MARKETING: "Marketing",
  PERSONALIZACAO: "Personalização",
};

/**
 * Seção 34 do manual: "schema por evento, limite de tamanho e allowlist" —
 * fechado em código (não um enum no banco) pra poder crescer sem migration,
 * mesmo padrão já usado em `CommentEntityType`.
 */
export const TRACKING_EVENT_NAMES = [
  "page_view",
  "cta_click",
  "pricing_view",
  "form_submit",
  "purchase",
  "identify",
] as const;

export type TrackingEventName = (typeof TRACKING_EVENT_NAMES)[number];

export function isTrackingEventName(value: unknown): value is TrackingEventName {
  return typeof value === "string" && (TRACKING_EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * Seção 35: cada categoria de consentimento libera uma classe de evento.
 * `ESSENCIAL` cobre o que a seção 35 chama de "permitido quando necessário/
 * base legal adequada" — os eventos que a própria operação comercial depende
 * (uma solicitação de contato não pode ser bloqueada por falta de opt-in de
 * marketing). O resto depende de consentimento explícito de Analytics.
 */
export const TRACKING_EVENT_CONSENT_REQUIREMENT: Record<TrackingEventName, TrackingConsentCategory> = {
  page_view: "ANALYTICS",
  cta_click: "ANALYTICS",
  pricing_view: "ANALYTICS",
  form_submit: "ESSENCIAL",
  purchase: "ESSENCIAL",
  identify: "ESSENCIAL",
};

export interface ConsentSnapshot {
  essencial: boolean;
  analytics: boolean;
  marketing: boolean;
  personalizacao: boolean;
}

export function parseConsentSnapshot(value: unknown): ConsentSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.essencial !== "boolean") return null;
  return {
    essencial: v.essencial,
    analytics: v.analytics === true,
    marketing: v.marketing === true,
    personalizacao: v.personalizacao === true,
  };
}

/** Seção 35: "essencial é sempre permitido"; as outras categorias exigem opt-in explícito no snapshot. */
export function isConsentSatisfied(consent: ConsentSnapshot, requirement: TrackingConsentCategory): boolean {
  if (!consent.essencial) return false;
  if (requirement === "ESSENCIAL") return true;
  if (requirement === "ANALYTICS") return consent.analytics;
  if (requirement === "MARKETING") return consent.marketing;
  return consent.personalizacao;
}

/** Sessão expira depois de 30min sem evento novo — janela fixa nesta fatia (ver docs/DECISIONS.md). */
export const TRACKING_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Payload cap por request — mesmo espírito de "limite de tamanho" da seção 34, sem infra de fila ainda. */
export const TRACKING_MAX_EVENTS_PER_REQUEST = 20;
const MAX_PROPERTIES_JSON_LENGTH = 8000;
const MAX_PROPERTY_STRING_LENGTH = 500;
const MAX_PROPERTY_KEYS = 20;

/** Só valores primitivos, achatado — evita que `properties` vire um jeito de contornar o schema/allowlist do evento. */
export function validateProperties(value: unknown): Record<string, string | number | boolean | null> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PROPERTY_KEYS) return null;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of entries) {
    if (typeof raw === "string") {
      if (raw.length > MAX_PROPERTY_STRING_LENGTH) return null;
      result[key] = raw;
    } else if (typeof raw === "number" || typeof raw === "boolean" || raw === null) {
      result[key] = raw;
    } else {
      return null;
    }
  }
  if (JSON.stringify(result).length > MAX_PROPERTIES_JSON_LENGTH) return null;
  return result;
}

/** Parâmetros de query que nunca devem ser persistidos, mesmo vindo do próprio site do cliente (seção 34: "remover parâmetros sensíveis"). */
const SENSITIVE_QUERY_PARAMS = ["token", "senha", "password", "auth", "email", "cpf", "key", "secret"];

export interface NormalizedUrl {
  url: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export function normalizeTrackingUrl(rawUrl: unknown): NormalizedUrl {
  const empty: NormalizedUrl = { url: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null };
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return empty;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return empty;
  }
  const utmSource = parsed.searchParams.get("utm_source");
  const utmMedium = parsed.searchParams.get("utm_medium");
  const utmCampaign = parsed.searchParams.get("utm_campaign");
  const utmContent = parsed.searchParams.get("utm_content");
  const utmTerm = parsed.searchParams.get("utm_term");
  for (const param of SENSITIVE_QUERY_PARAMS) {
    parsed.searchParams.delete(param);
  }
  return {
    url: parsed.toString(),
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  };
}

export function normalizeReferrer(rawReferrer: unknown): string | null {
  const { url } = normalizeTrackingUrl(rawReferrer);
  return url;
}

/** Heurística simples de bot — sem serviço de detecção real ainda (ver docs/DECISIONS.md). */
const BOT_USER_AGENT_PATTERN = /bot|spider|crawl|headless|curl\/|wget\//i;

export function looksLikeBot(userAgent: string | null): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_USER_AGENT_PATTERN.test(userAgent);
}
