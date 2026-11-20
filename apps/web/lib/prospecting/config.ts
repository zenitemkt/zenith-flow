/** Configuração da prospecção automática da agência (fica em `ProspectingSettings.config`). */
export interface ProspectingConfig {
  /** Nichos buscados no Google Maps (ex.: "clínica odontológica"). */
  segments: string[];
  /** Cidades (ex.: "Americana, SP"). Cada segmento é buscado em cada cidade. */
  cities: string[];
  /** Máximo de empresas por combinação segmento + cidade em cada busca. */
  maxPerSearch: number;
  /** Teto de envios por dia (fases de disparo). */
  dailyLimits: { whatsapp: number; email: number };
}

export const DEFAULT_PROSPECTING_CONFIG: ProspectingConfig = {
  segments: [],
  cities: ["Americana, SP"],
  maxPerSearch: 30,
  dailyLimits: { whatsapp: 30, email: 200 },
};

const MAX_ITEMS = 10;
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const cleanList = (value: unknown, fallback: string[]) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))].slice(0, MAX_ITEMS).map((v) => v.slice(0, 80))
    : fallback;

export function mergeProspectingConfig(stored: unknown): ProspectingConfig {
  const s = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const limits = s.dailyLimits && typeof s.dailyLimits === "object" ? (s.dailyLimits as Record<string, unknown>) : {};
  const d = DEFAULT_PROSPECTING_CONFIG;
  return {
    segments: cleanList(s.segments, d.segments),
    cities: cleanList(s.cities, d.cities),
    maxPerSearch: clamp(s.maxPerSearch, 5, 100, d.maxPerSearch),
    dailyLimits: { whatsapp: clamp(limits.whatsapp, 0, 100, d.dailyLimits.whatsapp), email: clamp(limits.email, 0, 500, d.dailyLimits.email) },
  };
}
