import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { publishDueSocialPosts } from "@/lib/social-publisher";
import { processDueFlowSessions } from "@/lib/instagram-flow";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Chamado a cada minuto por um agendador externo (cron-job.org) — o plano
 * Hobby da Vercel só roda cron 1x/dia. Protegido por `CRON_SECRET` no header
 * `Authorization: Bearer <segredo>` (mesmo formato que a Vercel Cron usa).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  // Mesmo cron de minuto em minuto retoma as sequências do mini-chat de Instagram (atrasos e perguntas sem resposta).
  const started = Date.now();
  const flows = await processDueFlowSessions(12_000).catch((error) => ({ error: error instanceof Error ? error.message : "falha" }));
  const summary = await publishDueSocialPosts(Math.max(20_000, 50_000 - (Date.now() - started)));
  return NextResponse.json({ ok: true, ...summary, instagramFlows: flows });
}

export const GET = handle;
export const POST = handle;
