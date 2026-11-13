import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { parsePlan, validatePlan } from "@/lib/traffic-campaigns";

/** Lista o que impede subir a campanha (usado na etapa de revisão). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const row = await prisma.trafficCampaign.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!row) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  return NextResponse.json({ issues: await validatePlan(membership.agencyId, parsePlan(row.plan)) });
}
