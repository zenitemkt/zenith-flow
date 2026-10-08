import type { TrackingConsentCategory } from "@zenite-mkt/db";

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
  "session_start",
  "page_view",
  "service_view",
  "cta_click",
  "whatsapp_click",
  "phone_click",
  "email_click",
  "pricing_view",
  "form_view",
  "form_start",
  "form_error",
  "form_abandon",
  "form_submit",
  "download",
  "scroll_depth",
  "engaged_session",
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
  session_start: "ANALYTICS",
  page_view: "ANALYTICS",
  service_view: "ANALYTICS",
  cta_click: "ANALYTICS",
  whatsapp_click: "ANALYTICS",
  phone_click: "ANALYTICS",
  email_click: "ANALYTICS",
  pricing_view: "ANALYTICS",
  form_view: "ANALYTICS",
  form_start: "ANALYTICS",
  form_error: "ANALYTICS",
  form_abandon: "ANALYTICS",
  form_submit: "ESSENCIAL",
  download: "ANALYTICS",
  scroll_depth: "ANALYTICS",
  engaged_session: "ANALYTICS",
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

export interface DeviceInfo {
  deviceType: "mobile" | "tablet" | "desktop" | null;
  browser: string | null;
}

/**
 * Parse simples de `User-Agent` (seção 2 do plano de Traqueamento,
 * 2026-09-30) — sem biblioteca nova, mesmo espírito de `looksLikeBot()`
 * acima: um regex por categoria cobre o que interessa pro painel (não
 * precisamos de versão exata de OS/navegador, só a categoria).
 */
export function parseDeviceInfo(userAgent: string | null): DeviceInfo {
  if (!userAgent) return { deviceType: null, browser: null };

  let deviceType: DeviceInfo["deviceType"] = "desktop";
  if (/tablet|ipad/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (/mobi|android|iphone/i.test(userAgent)) {
    deviceType = "mobile";
  }

  let browser: string | null = null;
  if (/edg\//i.test(userAgent)) browser = "Edge";
  else if (/opr\/|opera/i.test(userAgent)) browser = "Opera";
  else if (/chrome\//i.test(userAgent) && !/chromium/i.test(userAgent)) browser = "Chrome";
  else if (/crios\//i.test(userAgent)) browser = "Chrome";
  else if (/fxios\//i.test(userAgent)) browser = "Firefox";
  else if (/firefox\//i.test(userAgent)) browser = "Firefox";
  else if (/safari\//i.test(userAgent) && /version\//i.test(userAgent)) browser = "Safari";

  return { deviceType, browser };
}
