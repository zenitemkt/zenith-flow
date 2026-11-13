import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { syncCreativeFolder } from "@/lib/ad-creatives";

export const maxDuration = 60;

/** Relê as pastas do Drive da agência (botão "Sincronizar"). */
export async function POST() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const folders = await prisma.adCreativeFolder.findMany({ where: { agencyId: membership.agencyId } });
  const totals = { added: 0, updated: 0, missing: 0 };
  try {
    for (const folder of folders) {
      const result = await syncCreativeFolder(folder);
      totals.added += result.added;
      totals.updated += result.updated;
      totals.missing += result.missing;
    }
    return NextResponse.json({ ok: true, ...totals });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler o Drive." }, { status: 502 });
  }
}
