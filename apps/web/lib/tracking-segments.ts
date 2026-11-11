import type { Campaign } from "@prisma/client";
import { resolveTouchpoint } from "@/lib/attribution";

/**
 * Filtros de segmento do Traqueamento. Cada dimensão lê um atributo da sessão.
 * Escopo "primeiro": o filtro olha a PRIMEIRA sessão do visitante (primeiro toque), e todas as sessões
 * desse visitante no período entram. Escopo "sessao": o filtro olha cada sessão.
 */
export type SegmentScope = "primeiro" | "sessao";

export interface SegmentSession {
  id: string;
  visitorId: string;
  startedAt: Date;
  landingUrl: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  city: string | null;
  region: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
}

const DEVICE: Record<string, string> = { desktop: "Computador", mobile: "Celular", tablet: "Tablet" };

function landingPath(url: string | null): string {
  if (!url) return "(sem página)";
  try {
    const path = decodeURIComponent(new URL(url).pathname).replace(/\/+$/, "");
    return path || "/";
  } catch {
    return url;
  }
}

export const SEGMENT_DIMENSIONS: { key: string; label: string; get: (s: SegmentSession, campaigns: Campaign[]) => string }[] = [
  { key: "origem", label: "Origem", get: (s, c) => resolveTouchpoint(s, c).channel },
  { key: "midia", label: "Mídia (utm_medium)", get: (s) => s.utmMedium?.trim() || "(nenhuma)" },
  { key: "campanha", label: "Campanha (utm_campaign)", get: (s) => s.utmCampaign?.trim() || "(nenhuma)" },
  { key: "conteudo", label: "Conteúdo (utm_content)", get: (s) => s.utmContent?.trim() || "(nenhum)" },
  { key: "termo", label: "Termo (utm_term)", get: (s) => s.utmTerm?.trim() || "(nenhum)" },
  { key: "pagina", label: "Página de entrada", get: (s) => landingPath(s.landingUrl) },
  { key: "cidade", label: "Cidade", get: (s) => s.city?.trim() || "(desconhecida)" },
  { key: "estado", label: "Estado", get: (s) => s.region?.trim() || "(desconhecido)" },
  { key: "aparelho", label: "Aparelho", get: (s) => DEVICE[s.deviceType ?? ""] ?? "Desconhecido" },
  { key: "navegador", label: "Navegador", get: (s) => s.browser?.trim() || "(desconhecido)" },
  { key: "sistema", label: "Sistema", get: (s) => s.os?.trim() || "(desconhecido)" },
];

export function readSegmentFilters(searchParams: Record<string, string | undefined>): { scope: SegmentScope; filters: Record<string, string> } {
  const filters: Record<string, string> = {};
  for (const d of SEGMENT_DIMENSIONS) {
    const value = searchParams[d.key];
    if (value) filters[d.key] = value;
  }
  return { scope: searchParams.escopo === "sessao" ? "sessao" : "primeiro", filters };
}

/** Aplica os filtros e devolve as sessões que ficam, mais as opções (com contagem) de cada dimensão. */
export function applySegmentFilters<T extends SegmentSession>(
  sessions: T[],
  firstSessionByVisitor: Map<string, SegmentSession>,
  campaigns: Campaign[],
  scope: SegmentScope,
  filters: Record<string, string>,
): { sessions: T[]; options: { key: string; label: string; values: { value: string; count: number }[] }[] } {
  const reference = (s: T): SegmentSession => (scope === "primeiro" ? firstSessionByVisitor.get(s.visitorId) ?? s : s);
  const matches = (s: T, skipKey?: string) =>
    SEGMENT_DIMENSIONS.every((d) => d.key === skipKey || !filters[d.key] || d.get(reference(s), campaigns) === filters[d.key]);

  // Opções de cada dimensão contam visitantes (escopo primeiro) ou sessões, considerando os OUTROS filtros ativos.
  const options = SEGMENT_DIMENSIONS.map((d) => {
    const counts = new Map<string, Set<string>>();
    for (const s of sessions) {
      if (!matches(s, d.key)) continue;
      const value = d.get(reference(s), campaigns);
      const set = counts.get(value) ?? new Set<string>();
      set.add(scope === "primeiro" ? s.visitorId : s.id);
      counts.set(value, set);
    }
    const values = Array.from(counts.entries())
      .map(([value, set]) => ({ value, count: set.size }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { key: d.key, label: d.label, values };
  });

  const active = Object.keys(filters).length > 0;
  return { sessions: active ? sessions.filter((s) => matches(s)) : sessions, options };
}
