import { prisma } from "@zenite-mkt/db";

export interface SitePageView {
  url: string | null;
  occurredAt: Date;
}

export interface SiteInteraction {
  eventName: string;
  label: string;
  href: string | null;
  occurredAt: Date;
}

export interface SiteVisit {
  sessionId: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  pageViews: SitePageView[];
  interactions: SiteInteraction[];
}

export interface LeadSiteActivity {
  visitsCount: number;
  totalDurationSeconds: number;
  pageViewsCount: number;
  serviceViewsCount: number;
  whatsappClicksCount: number;
  formStartsCount: number;
  formSubmitsCount: number;
  visits: SiteVisit[];
}

function readStringProperty(properties: unknown, key: string): string | null {
  if (!properties || typeof properties !== "object") return null;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function interactionLabel(eventName: string, properties: unknown): string | null {
  const label = readStringProperty(properties, "label");
  const service = readStringProperty(properties, "service");
  if (eventName === "service_view") return `Visualizou serviço: ${service ?? "não identificado"}`;
  if (eventName === "whatsapp_click") return "Clicou no WhatsApp";
  if (eventName === "phone_click") return "Clicou para telefonar";
  if (eventName === "email_click") return "Clicou para enviar e-mail";
  if (eventName === "download") return `Baixou arquivo: ${label ?? "arquivo"}`;
  if (eventName === "form_view") return "Visualizou o formulário de orçamento";
  if (eventName === "form_start") return "Começou a preencher o formulário";
  if (eventName === "form_error") return `Encontrou erro no campo ${readStringProperty(properties, "field") ?? "não identificado"}`;
  if (eventName === "form_abandon") return "Saiu sem concluir o formulário";
  if (eventName === "form_submit") return "Enviou o formulário de orçamento";
  if (eventName === "pricing_view") return "Visualizou a página de orçamento";
  if (eventName === "cta_click") return label ? `Clicou: ${label}` : "Clicou em uma chamada";
  return null;
}

export async function getLeadSiteActivity(agencyId: string, leadId: string): Promise<LeadSiteActivity> {
  const visitors = await prisma.trackingVisitor.findMany({
    where: { agencyId, leadId },
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
        include: { events: { orderBy: { occurredAt: "asc" } } },
      },
    },
  });

  const visits: SiteVisit[] = [];
  let pageViewsCount = 0;
  let serviceViewsCount = 0;
  let whatsappClicksCount = 0;
  let formStartsCount = 0;
  let formSubmitsCount = 0;

  for (const visitor of visitors) {
    for (const session of visitor.sessions) {
      const pageViews: SitePageView[] = [];
      const interactions: SiteInteraction[] = [];
      for (const event of session.events) {
        if (event.eventName === "page_view") {
          pageViews.push({ url: event.url, occurredAt: event.occurredAt });
          pageViewsCount += 1;
        }
        if (event.eventName === "service_view") serviceViewsCount += 1;
        if (event.eventName === "whatsapp_click") whatsappClicksCount += 1;
        if (event.eventName === "form_start") formStartsCount += 1;
        if (event.eventName === "form_submit") formSubmitsCount += 1;
        const label = interactionLabel(event.eventName, event.properties);
        if (label) interactions.push({ eventName: event.eventName, label, href: readStringProperty(event.properties, "href"), occurredAt: event.occurredAt });
      }
      visits.push({
        sessionId: session.id,
        startedAt: session.startedAt,
        endedAt: session.lastEventAt,
        durationSeconds: Math.max(0, (session.lastEventAt.getTime() - session.startedAt.getTime()) / 1000),
        pageViews,
        interactions,
      });
    }
  }

  visits.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return {
    visitsCount: visits.length,
    totalDurationSeconds: visits.reduce((sum, visit) => sum + visit.durationSeconds, 0),
    pageViewsCount,
    serviceViewsCount,
    whatsappClicksCount,
    formStartsCount,
    formSubmitsCount,
    visits,
  };
}

export function formatSiteDuration(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}
