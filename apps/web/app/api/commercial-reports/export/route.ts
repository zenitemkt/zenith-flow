import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { resolvePipelinePeriod } from "@/lib/pipeline-period";
import { buildCommercialReport, buildCommercialReportCsv } from "@/lib/commercial-reports";

export async function GET(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const period = resolvePipelinePeriod({ period: params.get("period") ?? undefined, year: params.get("year") ?? undefined, month: params.get("month") ?? undefined, from: params.get("from") ?? undefined, to: params.get("to") ?? undefined });
  const report = await buildCommercialReport(membership.agencyId, { range: period.createdAt, origin: params.get("origin") ?? undefined, campaign: params.get("campaign") ?? undefined, service: params.get("service") ?? undefined });
  return new NextResponse(buildCommercialReportCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-comercial-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
