import { NextResponse } from "next/server";
import { prisma, type TrackingConsentCategory } from "@zenite-mkt/db";
import { TRACKING_CONSENT_CATEGORIES } from "@/lib/tracking";
import { resolveVisitor } from "@/lib/tracking-ingest";

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
 * Registro de decisão de consentimento (seção 35) — append-only, uma linha
 * por decisão. `ESSENCIAL` é sempre incluída no registro mesmo que o
 * visitante não tenha marcado nada explicitamente, pra o registro em si
 * nunca depender de uma regra externa pra saber "o que essa ausência significa".
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

  const noticeVersion = typeof body?.noticeVersion === "string" ? body.noticeVersion.trim() : "";
  if (!noticeVersion) {
    return json({ error: "Informe noticeVersion." }, 400);
  }

  const requested: unknown[] = Array.isArray(body?.categories) ? body.categories : [];
  const granted = requested.filter((c): c is TrackingConsentCategory =>
    typeof c === "string" && (TRACKING_CONSENT_CATEGORIES as string[]).includes(c),
  );
  const categories = Array.from(new Set<TrackingConsentCategory>(["ESSENCIAL", ...granted]));

  const visitor = await resolveVisitor(agency.id, body?.visitorId);

  const consent = await prisma.trackingConsent.create({
    data: { agencyId: agency.id, visitorId: visitor.id, categories, noticeVersion },
  });

  return json({ visitorId: visitor.id, id: consent.id, categories }, 201);
}
