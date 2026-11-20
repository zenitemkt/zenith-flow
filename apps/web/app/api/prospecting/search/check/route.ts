import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { checkProspectSearch } from "@/lib/prospecting/search";

export const maxDuration = 60;

/** A tela chama enquanto há busca em andamento: importa o que já terminou no Apify. */
export async function POST() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  return NextResponse.json(await checkProspectSearch(membership.agencyId));
}
