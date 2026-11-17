import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { generateCompetitorContentIdeas } from "@/lib/competitor-content-ideas";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const days = [30, 90, 180, 365].includes(Number(body?.days)) ? Number(body.days) : 90;
  if (!clientId || !(await canSeeClient(membership.agencyId, session.user.id, clientId))) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  try {
    const ideas = await generateCompetitorContentIdeas(clientId, membership.agencyId, days);
    return NextResponse.json({ ideas, generatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar as pautas." }, { status: 502 });
  }
}
