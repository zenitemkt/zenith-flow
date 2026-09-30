import { prisma } from "@zenite-mkt/db";

/**
 * "Atividade no site" por lead (pedido do usuário, 2026-09-30) — complementa
 * `getLeadJourney`/`lib/attribution.ts` (que resolve canal/crédito de
 * atribuição por sessão). Aqui o objetivo é outro: mostrar o detalhe bruto de
 * cada visita — quantas vezes o lead voltou, quais páginas viu, em quais
 * botões clicou e quanto tempo ficou — sem nenhum modelo de atribuição
 * envolvido. Lê as mesmas tabelas (`TrackingVisitor`/`TrackingSession`/
 * `TrackingEvent`), nenhuma tabela nova.
 */

export interface SitePageView {
  url: string | null;
  occurredAt: Date;
}

export interface SiteCtaClick {
  label: string | null;
  href: string | null;
  occurredAt: Date;
}

export interface SiteVisit {
  sessionId: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  pageViews: SitePageView[];
  ctaClicks: SiteCtaClick[];
}

export interface LeadSiteActivity {
  visitsCount: number;
  totalDurationSeconds: number;
  visits: SiteVisit[];
}

function readStringProperty(properties: unknown, key: string): string | null {
  if (!properties || typeof properties !== "object") return null;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function getLeadSiteActivity(agencyId: string, leadId: string): Promise<LeadSiteActivity> {
  const visitors = await prisma.trackingVisitor.findMany({
    where: { agencyId, leadId },
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
        include: {
          events: {
            where: { eventName: { in: ["page_view", "cta_click"] } },
            orderBy: { occurredAt: "asc" },
          },
        },
      },
    },
  });

  const visits: SiteVisit[] = [];
  for (const visitor of visitors) {
    for (const session of visitor.sessions) {
      const pageViews: SitePageView[] = [];
      const ctaClicks: SiteCtaClick[] = [];
      for (const event of session.events) {
        if (event.eventName === "page_view") {
          pageViews.push({ url: event.url, occurredAt: event.occurredAt });
        } else if (event.eventName === "cta_click") {
          ctaClicks.push({
            label: readStringProperty(event.properties, "label"),
            href: readStringProperty(event.properties, "href"),
            occurredAt: event.occurredAt,
          });
        }
      }
      const durationSeconds = Math.max(0, (session.lastEventAt.getTime() - session.startedAt.getTime()) / 1000);
      visits.push({
        sessionId: session.id,
        startedAt: session.startedAt,
        endedAt: session.lastEventAt,
        durationSeconds,
        pageViews,
        ctaClicks,
      });
    }
  }

  visits.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const totalDurationSeconds = visits.reduce((sum, visit) => sum + visit.durationSeconds, 0);

  return { visitsCount: visits.length, totalDurationSeconds, visits };
}

export function formatSiteDuration(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}
