import { NextResponse } from "next/server";
import { prisma, Prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { emptyPlan, parsePlan } from "@/lib/traffic-campaigns";
import { buildExtendPlan } from "@/lib/traffic-extend";

/** Cria um rascunho de campanha (vazio ou com o plano enviado). */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  let plan = body?.plan ? parsePlan(body.plan) : emptyPlan();
  // Inclusão em campanha existente: lê da Meta a numeração, o orçamento e o formulário do conjunto.
  if ((body?.mode === "ADD_ADSETS" || body?.mode === "ADD_ADS") && typeof body?.metaCampaignId === "string") {
    try {
      plan = await buildExtendPlan(membership.agencyId, body.mode, body.metaCampaignId, typeof body.metaAdSetId === "string" ? body.metaAdSetId : null);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui ler a campanha na Meta." }, { status: 400 });
    }
  }
  const row = await prisma.trafficCampaign.create({
    data: { agencyId: membership.agencyId, name: plan.name, plan: plan as unknown as Prisma.InputJsonValue, createdByUserId: session.user.id },
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
