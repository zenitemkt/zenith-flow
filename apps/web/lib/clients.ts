import type { ClientStatus } from "@zenite-mkt/db";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  PROSPECT: "Prospect",
  ONBOARDING: "Onboarding",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  EM_ENCERRAMENTO: "Em encerramento",
  ENCERRADO: "Encerrado",
  REATIVADO: "Reativado",
};

/** Seção 10 do manual: prospect -> onboarding -> ativo -> pausado -> em encerramento -> encerrado -> reativado. */
export const CLIENT_STATUS_TRANSITIONS: Record<ClientStatus, ClientStatus[]> = {
  PROSPECT: ["ONBOARDING"],
  ONBOARDING: ["ATIVO"],
  ATIVO: ["PAUSADO", "EM_ENCERRAMENTO"],
  PAUSADO: ["ATIVO", "EM_ENCERRAMENTO"],
  EM_ENCERRAMENTO: ["ENCERRADO"],
  ENCERRADO: ["REATIVADO"],
  REATIVADO: ["ATIVO"],
};

export function canTransition(from: ClientStatus, to: ClientStatus): boolean {
  return CLIENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * "Ativo"/"Inativo" do cartão de cliente (pedido do usuário, 2026-10-20): visão
 * simplificada em cima do ciclo de vida de 7 estados. Prospect conta como
 * inativo porque ainda não é cliente da carteira.
 */
const ACTIVE_STATUSES: ClientStatus[] = ["ATIVO", "ONBOARDING", "REATIVADO", "EM_ENCERRAMENTO"];

export function isClientActive(status: ClientStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Clientes que entram no filtro de uma tela: os ativos (mais o já filtrado, mesmo
 * inativo). Se a carteira não tiver nenhum ativo, lista todos — melhor um filtro
 * completo do que o filtro sumir.
 */
export function filterableClients<T extends { id: string; name: string; status: ClientStatus }>(
  clients: T[],
  activeClientId?: string,
): { id: string; name: string }[] {
  const active = clients.filter((c) => isClientActive(c.status));
  const pool = active.length > 0 ? clients.filter((c) => active.includes(c) || c.id === activeClientId) : clients;
  return pool.map(({ id, name }) => ({ id, name }));
}

export const SOCIAL_NETWORKS = [
  { id: "instagram", label: "Instagram", placeholder: "@perfil ou link" },
  { id: "facebook", label: "Facebook", placeholder: "página ou link" },
  { id: "tiktok", label: "TikTok", placeholder: "@perfil ou link" },
  { id: "youtube", label: "YouTube", placeholder: "@canal ou link" },
  { id: "linkedin", label: "LinkedIn", placeholder: "empresa ou link" },
  { id: "site", label: "Site", placeholder: "www.exemplo.com.br" },
  { id: "whatsapp", label: "WhatsApp", placeholder: "(11) 99999-9999" },
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]["id"];
export type SocialLinks = Partial<Record<SocialNetworkId, string>>;

export const EMPTY_SOCIAL_VALUES = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, ""])) as Record<SocialNetworkId, string>;

const SOCIAL_BASE_URL: Record<Exclude<SocialNetworkId, "site" | "whatsapp">, string> = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/@",
  linkedin: "https://linkedin.com/company/",
};

/**
 * Aceita @perfil, perfil ou link completo e devolve sempre uma URL http(s) —
 * ou null se vazio/inválido. Só http/https passam, pra nunca guardar
 * `javascript:` num link que vira <a href>.
 */
export function normalizeSocialUrl(network: SocialNetworkId, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (network === "whatsapp") {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10) return null;
    return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return /^https?:\/\//i.test(value) ? value : null;
  }
  if (network === "site" || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(value)) {
    return `https://${value}`;
  }
  return `${SOCIAL_BASE_URL[network]}${value.replace(/^@/, "")}`;
}

/** Lê o JSON do banco com tolerância: ignora redes desconhecidas e valores que não são URL http(s). */
export function parseSocialLinks(json: unknown): SocialLinks {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const source = json as Record<string, unknown>;
  const links: SocialLinks = {};
  for (const { id } of SOCIAL_NETWORKS) {
    const value = source[id];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) links[id] = value;
  }
  return links;
}

/** Texto curto do chip: @perfil, domínio ou número. */
export function socialChipLabel(network: SocialNetworkId, url: string): string {
  try {
    const parsed = new URL(url);
    if (network === "site") return parsed.hostname.replace(/^www\./, "");
    if (network === "whatsapp") return parsed.pathname.replace("/", "");
    const last = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname;
    return last.startsWith("@") ? last : `@${last}`;
  } catch {
    return url;
  }
}

/** Banner padrão quando o cliente não enviou imagem — estável por cliente, sem precisar guardar nada. */
const BANNER_GRADIENTS = [
  "linear-gradient(135deg,#4b5563,#9ca3af)",
  "linear-gradient(135deg,#3b82f6,#7aa2ff)",
  "linear-gradient(135deg,#86c99b,#c6e6cf)",
  "linear-gradient(135deg,#ec4899,#f9a8d4)",
  "linear-gradient(135deg,#06b6d4,#67e8f9)",
  "linear-gradient(135deg,#16a34a,#6ee7a0)",
  "linear-gradient(135deg,#f97316,#fdba74)",
  "linear-gradient(135deg,#8b5cf6,#c4b5fd)",
];

export function defaultBannerGradient(clientId: string): string {
  let hash = 0;
  for (const char of clientId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BANNER_GRADIENTS[hash % BANNER_GRADIENTS.length]!;
}

export function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? ""))).toUpperCase();
}

export const CLIENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CLIENT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
