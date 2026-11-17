import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { generateMonthlyCompetitorReport, monthKey, previousClosedMonth } from "@/lib/competitor-reports";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** No primeiro dia do mês, fecha o mês anterior para cada cliente com base de comparação completa. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const month = previousClosedMonth();
  const clients = await prisma.client.findMany({
    where: { competitors: { some: { isOwn: true } }, AND: { competitors: { some: { isOwn: false } } } },
    select: { id: true, agencyId: true },
    orderBy: { id: "asc" },
  });
  const startedAt = Date.now();
  const results: { clientId: string; ok: boolean; detail: string }[] = [];
  for (const client of clients) {
    if (Date.now() - startedAt > 52_000) break;
    try {
      const report = await generateMonthlyCompetitorReport({ clientId: client.id, agencyId: client.agencyId, month });
      results.push({ clientId: client.id, ok: true, detail: report.generatedAt.toISOString() });
    } catch (error) {
      console.error("competitor_monthly_report_failed", client.id, monthKey(month), error);
      results.push({ clientId: client.id, ok: false, detail: error instanceof Error ? error.message : "Falha." });
    }
  }
  return NextResponse.json({ month: monthKey(month), eligible: clients.length, processed: results.length, results });
}
