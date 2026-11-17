import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { searchGooglePlaces } from "@/lib/google-places";

export async function GET(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  try {
    const places = await searchGooglePlaces(new URL(request.url).searchParams.get("q") ?? "");
    return NextResponse.json({ places });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível pesquisar." }, { status: 502 });
  }
}
