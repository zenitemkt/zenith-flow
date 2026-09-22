import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { looksLikeBot, normalizeReferrer, normalizeTrackingUrl, TRACKING_MAX_EVENTS_PER_REQUEST } from "@/lib/tracking";
import { processTrackingEvent, resolveSession, resolveVisitor } from "@/lib/tracking-ingest";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Coletor first-party (seção 34 do manual). Chamado direto do navegador de
 * sites/landing pages externos — por isso `writeKey` no corpo (não sessão) e
 * CORS liberado (mesmo modelo de GA4/Segment/Meta Pixel: a chave é pública,
 * a segurança real é o consent gate e a validação de schema abaixo).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const writeKey = typeof body?.writeKey === "string" ? body.writeKey : null;
  if (!writeKey) {
    return json({ error: "writeKey ausente." }, 400);
  }

  const agency = await prisma.agency.findUnique({ where: { trackingWriteKey: writeKey } });
  if (!agency) {
    return json({ error: "writeKey inválido." }, 401);
  }

  if (looksLikeBot(request.headers.get("user-agent"))) {
    return json({ visitorId: null, sessionId: null, results: [] }, 202);
  }

  const rawEvents: unknown[] = Array.isArray(body?.events) ? body.events : [];
  if (rawEvents.length === 0) {
    return json({ error: "Informe ao menos um evento em events." }, 400);
  }
  if (rawEvents.length > TRACKING_MAX_EVENTS_PER_REQUEST) {
    return json({ error: `No máximo ${TRACKING_MAX_EVENTS_PER_REQUEST} eventos por chamada.` }, 400);
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const recentCount = await prisma.trackingEvent.count({
    where: { agencyId: agency.id, occurredAt: { gte: oneMinuteAgo } },
  });
  if (recentCount > 1000) {
    return json({ error: "Limite de eventos por minuto excedido para esta chave." }, 429);
  }

  const visitor = await resolveVisitor(agency.id, body?.visitorId);

  const firstEvent = rawEvents[0] as Record<string, unknown> | undefined;
  const firstUrl = normalizeTrackingUrl(firstEvent?.url);
  const session = await resolveSession(visitor.id, body?.sessionId, {
    landingUrl: firstUrl.url,
    referrer: normalizeReferrer(firstEvent?.referrer),
    utmSource: firstUrl.utmSource,
    utmMedium: firstUrl.utmMedium,
    utmCampaign: firstUrl.utmCampaign,
    utmContent: firstUrl.utmContent,
    utmTerm: firstUrl.utmTerm,
  });

  const results = [];
  for (const raw of rawEvents) {
    results.push(await processTrackingEvent(agency.id, visitor.id, session.id, raw));
  }

  await prisma.trackingVisitor.update({ where: { id: visitor.id }, data: { lastSeenAt: new Date() } });
  await prisma.trackingSession.update({ where: { id: session.id }, data: { lastEventAt: new Date() } });

  return json({ visitorId: visitor.id, sessionId: session.id, results }, 200);
}
