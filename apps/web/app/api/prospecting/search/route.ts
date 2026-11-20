import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { startProspectSearch } from "@/lib/prospecting/search";

export const maxDuration = 60;

/** "Buscar leads": dispara as buscas no Google Maps (o resultado chega em alguns minutos, via /check). */
export async function POST() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  try {
    return NextResponse.json(await startProspectSearch(membership.agencyId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível iniciar a busca." }, { status: 400 });
  }
}
