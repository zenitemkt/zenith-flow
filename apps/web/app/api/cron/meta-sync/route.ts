import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { syncMetaCampaigns } from "@/lib/meta-campaign-sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Sincronização diária da Meta para o Tráfego - Raio X (vercel.json: 06:00 de Brasília):
 * campanhas, conjuntos, anúncios, números diários, mapa e situação dos criativos.
 * A Vercel manda `Authorization: Bearer <CRON_SECRET>`.
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
  const connections = await prisma.adAccountConnection.findMany({ where: { platform: "META", status: "ACTIVE" }, select: { agencyId: true } });
  const results: { agencyId: string; ok: boolean; detail: string }[] = [];
  for (const { agencyId } of connections) {
    try {
      const r = await syncMetaCampaigns(agencyId);
      results.push({ agencyId, ok: !r.levelsError, detail: `${r.campaignsFound} campanhas, ${r.adSetsSynced ?? 0} conjuntos, ${r.adsSynced ?? 0} anúncios, ${r.periodDays} dias${r.levelsError ? ` · ${r.levelsError}` : ""}` });
    } catch (error) {
      console.error("meta_cron_sync_failed", agencyId, error);
      results.push({ agencyId, ok: false, detail: error instanceof Error ? error.message : "Falha." });
    }
  }
  return NextResponse.json({ ok: true, results });
}
