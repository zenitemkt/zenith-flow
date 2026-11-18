import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { syncAllCompetitors } from "@/lib/competitors";
import { generateCompetitorAlerts } from "@/lib/competitor-alerts";
import { syncAllGooglePlaces } from "@/lib/google-places";
import { syncAllCompetitorWebsites } from "@/lib/competitor-pagespeed";
import { generateMonthlyCompetitorReport, monthKey, previousClosedMonth } from "@/lib/competitor-reports";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Rotina diária da Análise de Concorrentes: Instagram, alertas, Google e velocidade dos sites.
 * No primeiro dia do mês, fecha também os relatórios do mês anterior. Tudo num agendamento só,
 * porque o plano da Vercel limita quantos agendamentos o projeto pode ter.
 * A cada etapa sobra menos tempo: o que não couber hoje entra na rodada de amanhã.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const startedAt = Date.now();
  const left = (reserve: number) => Math.max(0, 52_000 - (Date.now() - startedAt) - reserve);

  const instagram = await syncAllCompetitors(left(22_000));

  let alerts = 0;
  let alertFailures = 0;
  const agencies = await prisma.competitor.findMany({ distinct: ["agencyId"], select: { agencyId: true } });
  for (const { agencyId } of agencies) {
    try {
      alerts += (await generateCompetitorAlerts(agencyId)).alerts;
    } catch (error) {
      alertFailures += 1;
      console.error("competitor_alert_generation_failed", agencyId, error);
    }
  }

  const google = await syncAllGooglePlaces(left(12_000)).catch((error) => {
    console.error("competitor_google_sync_failed", error);
    return null;
  });
  const pagespeed = await syncAllCompetitorWebsites(left(2_000)).catch((error) => {
    console.error("competitor_pagespeed_sync_failed", error);
    return null;
  });

  // Relatório mensal: só no dia 1, e só com tempo sobrando.
  const reports: { month: string; ok: number; failed: number } | null = new Date(Date.now() - 3 * 3600_000).getUTCDate() === 1 && left(0) > 12_000 ? await (async () => {
    const month = previousClosedMonth();
    const clients = await prisma.client.findMany({
      where: { competitors: { some: { isOwn: true } }, AND: { competitors: { some: { isOwn: false, category: "DIRECT" } } } },
      select: { id: true, agencyId: true },
      orderBy: { id: "asc" },
    });
    let ok = 0;
    let failed = 0;
    for (const client of clients) {
      if (left(0) < 8_000) break;
      try {
        await generateMonthlyCompetitorReport({ clientId: client.id, agencyId: client.agencyId, month });
        ok += 1;
      } catch (error) {
        failed += 1;
        console.error("competitor_monthly_report_failed", client.id, monthKey(month), error);
      }
    }
    return { month: monthKey(month), ok, failed };
  })() : null;

  return NextResponse.json({ instagram, alerts, alertFailures, google, pagespeed, reports });
}
