import { DEFAULT_EMAIL_STEPS, DEFAULT_WHATSAPP_OPENER } from "./copy";

/** Configuração da prospecção automática da agência (fica em `ProspectingSettings.config`). */
export interface ProspectingConfig {
  /** Nichos buscados no Google Maps (ex.: "clínica odontológica"). */
  segments: string[];
  /** Cidades (ex.: "Americana, SP"). Cada segmento é buscado em cada cidade. */
  cities: string[];
  /** Máximo de empresas por combinação segmento + cidade em cada busca. */
  maxPerSearch: number;
  /** Teto de envios por dia. */
  dailyLimits: { whatsapp: number; email: number };
  /** Mensagem pronta do primeiro contato (enviada à mão pelo celular, como a Milena). */
  whatsappOpener: string;
  email: {
    enabled: boolean;
    /** Remetente (domínio verificado no Resend). Vazio = remetente padrão do sistema. */
    fromEmail: string;
    /** Pra onde vão as respostas (caixa de alguém da equipe). */
    replyTo: string;
    /** Primeiro e-mail e lembrete 3 dias depois. */
    steps: { subject: string; body: string }[];
  };
}

/** Lembrete por e-mail sai 3 dias depois do primeiro, pra quem não respondeu. */
export const EMAIL_FOLLOW_UP_DAYS = 3;

export const DEFAULT_PROSPECTING_CONFIG: ProspectingConfig = {
  segments: [],
  cities: ["Americana, SP"],
  maxPerSearch: 30,
  dailyLimits: { whatsapp: 30, email: 50 },
  whatsappOpener: DEFAULT_WHATSAPP_OPENER,
  email: { enabled: false, fromEmail: "", replyTo: "", steps: DEFAULT_EMAIL_STEPS },
};

const MAX_ITEMS = 10;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const cleanList = (value: unknown, fallback: string[]) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))].slice(0, MAX_ITEMS).map((v) => v.slice(0, 80))
    : fallback;
const text = (value: unknown, max: number, fallback: string) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback);
const email = (value: unknown) => (typeof value === "string" && EMAIL_RE.test(value.trim()) ? value.trim() : "");
const obj = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

export function mergeProspectingConfig(stored: unknown): ProspectingConfig {
  const s = obj(stored);
  const limits = obj(s.dailyLimits);
  const mail = obj(s.email);
  const d = DEFAULT_PROSPECTING_CONFIG;
  const storedSteps = Array.isArray(mail.steps) ? mail.steps : [];
  return {
    segments: cleanList(s.segments, d.segments),
    cities: cleanList(s.cities, d.cities),
    maxPerSearch: clamp(s.maxPerSearch, 5, 100, d.maxPerSearch),
    dailyLimits: { whatsapp: clamp(limits.whatsapp, 0, 100, d.dailyLimits.whatsapp), email: clamp(limits.email, 0, 500, d.dailyLimits.email) },
    whatsappOpener: text(s.whatsappOpener, 1000, d.whatsappOpener),
    email: {
      enabled: mail.enabled === true,
      fromEmail: email(mail.fromEmail),
      replyTo: email(mail.replyTo),
      steps: d.email.steps.map((fallback, i) => {
        const step = obj(storedSteps[i]);
        return { subject: text(step.subject, 150, fallback.subject), body: text(step.body, 4000, fallback.body) };
      }),
    },
  };
}
