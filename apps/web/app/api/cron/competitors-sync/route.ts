import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { generateCompetitorAlerts } from "@/lib/competitor-alerts";
import { syncAllCompetitors } from "@/lib/competitors";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Atualização diária dos concorrentes (perfil, posts e foto do dia). Protegida por CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const sync = await syncAllCompetitors();
  const agencies = await prisma.competitor.findMany({ distinct: ["agencyId"], select: { agencyId: true } });
  let alertCount = 0;
  let alertFailures = 0;
  for (const { agencyId } of agencies) {
    try {
      alertCount += (await generateCompetitorAlerts(agencyId)).alerts;
    } catch (error) {
      alertFailures += 1;
      console.error("competitor_alert_generation_failed", agencyId, error);
    }
  }
  return NextResponse.json({ ...sync, alerts: alertCount, alertFailures });
}
