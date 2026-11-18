import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { syncAllGooglePlaces } from "@/lib/google-places";
import { syncAllCompetitorWebsites } from "@/lib/competitor-pagespeed";

export const maxDuration = 60;

/** Botão "Atualizar todos": Google ou site de uma vez só, para o cliente + concorrentes diretos (referências ficam de fora). */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const kind = body?.kind === "google" || body?.kind === "site" ? body.kind : null;
  if (!kind) return NextResponse.json({ error: "Informe o tipo (google ou site)." }, { status: 400 });
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: membership.agencyId }, select: { id: true } });
  if (!client || !(await canSeeClient(membership.agencyId, session.user.id, client.id))) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  const result =
    kind === "google"
      ? await syncAllGooglePlaces(50_000, { clientId, directOnly: true })
      : await syncAllCompetitorWebsites(50_000, { clientId, directOnly: true });
  return NextResponse.json(result);
}
