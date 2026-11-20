import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyProspecting } from "@/lib/prospecting/daily";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Rotina diária da prospecção automática (Vercel Cron, 7h e 7h40 de Brasília). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ ok: true, agencies: await runDailyProspecting() });
}
