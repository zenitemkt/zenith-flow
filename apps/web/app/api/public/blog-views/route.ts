import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";

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
 * Contador de visualização real por artigo de blog — chamado direto do
 * navegador (mesmo modelo do coletor de tracking: writeKey pública no
 * corpo, CORS liberado). Deliberadamente SEM visitorId/sessionId/IP: não é
 * um evento de rastreamento de pessoa, é só um número agregado por slug, por
 * isso não passa pelo gate de consentimento do banner — reflete 100% dos
 * carregamentos de página, diferente do TrackingEvent.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const writeKey = typeof body?.writeKey === "string" ? body.writeKey : null;
  const slug = typeof body?.slug === "string" ? body.slug.trim().slice(0, 160) : null;
  if (!writeKey) return json({ error: "writeKey ausente." }, 400);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return json({ error: "slug inválido." }, 400);

  const agency = await prisma.agency.findUnique({ where: { trackingWriteKey: writeKey }, select: { id: true } });
  if (!agency) return json({ error: "writeKey inválido." }, 401);

  const updated = await prisma.blogPageViewCount.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug } },
    create: { agencyId: agency.id, slug, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  return json({ count: updated.count }, 200);
}
