import { createHash } from "node:crypto";
import { META_GRAPH_API_VERSION } from "@/lib/meta-ads";

/**
 * Meta Conversions API (seção 38.1 — Etapa 2 do plano de Traqueamento,
 * 2026-09-30). Sempre usado JUNTO com o Pixel do navegador (`tracking.js`),
 * nunca sozinho — os dois mandam o mesmo `event_id` e a Meta deduplica.
 *
 * Mapeamento de evento (precisa bater EXATAMENTE com o que o Pixel manda no
 * navegador, senão a dedup por `event_name`+`event_id` não funciona):
 *   page_view    -> PageView
 *   pricing_view -> ViewContent
 *   form_submit  -> Lead
 * Outros eventos nossos (`cta_click`, `identify`, `purchase`) não têm
 * equivalente padrão útil pra mandar agora — ficam de fora.
 */
export const META_EVENT_NAME_MAP: Record<string, string> = {
  page_view: "PageView",
  pricing_view: "ViewContent",
  form_submit: "Lead",
};

function hashForMeta(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface MetaCapiEventInput {
  eventName: string;
  eventId: string;
  occurredAt: Date;
  url: string | null;
  /** E-mail em texto puro — só existe o suficiente pra ser hasheado aqui dentro, nunca sai da função sem hash. */
  email?: string | null;
  phone?: string | null;
  /** `test_event_code` do Gerenciador de Eventos (Eventos de teste) — só pra verificação manual, nunca em produção de verdade. */
  testEventCode?: string | null;
}

export class MetaCapiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MetaCapiError";
  }
}

export async function sendMetaCapiEvent(pixelId: string, accessToken: string, event: MetaCapiEventInput): Promise<void> {
  const userData: Record<string, string[]> = {};
  if (event.email) userData.em = [hashForMeta(event.email)];
  const normalizedPhone = event.phone?.replace(/\D/g, "");
  if (normalizedPhone) userData.ph = [hashForMeta(normalizedPhone)];

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(event.occurredAt.getTime() / 1000),
        event_id: event.eventId,
        event_source_url: event.url ?? undefined,
        action_source: "website",
        user_data: userData,
      },
    ],
    test_event_code: event.testEventCode ?? undefined,
  };

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${pixelId}/events`);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? `Meta CAPI respondeu ${response.status}.`;
    throw new MetaCapiError(message, response.status);
  }
}
