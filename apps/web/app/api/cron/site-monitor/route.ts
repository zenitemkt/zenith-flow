import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runSiteMonitor } from "@/lib/site-monitor";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Monitor do site, chamado pelo cron da própria Vercel (vercel.json: 07:00 e 10:00 de Brasília,
 * a segunda logo depois da rotina do blog). A Vercel manda `Authorization: Bearer <CRON_SECRET>`.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = await runSiteMonitor();
    return NextResponse.json({ ok: true, checked: result.checked, broken: result.broken.length, trackingScriptOk: result.trackingScriptOk, eventsLast24h: result.eventsLast24h });
  } catch (error) {
    console.error("site_monitor_failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no monitor." }, { status: 500 });
  }
}
