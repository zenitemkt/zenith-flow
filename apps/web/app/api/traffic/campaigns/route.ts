import { NextResponse } from "next/server";
import { prisma, Prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { emptyPlan, parsePlan } from "@/lib/traffic-campaigns";

/** Cria um rascunho de campanha (vazio ou com o plano enviado). */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const plan = body?.plan ? parsePlan(body.plan) : emptyPlan();
  const row = await prisma.trafficCampaign.create({
    data: { agencyId: membership.agencyId, name: plan.name, plan: plan as unknown as Prisma.InputJsonValue, createdByUserId: session.user.id },
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
