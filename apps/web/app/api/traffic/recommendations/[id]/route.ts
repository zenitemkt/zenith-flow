import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { MetaWriteError } from "@/lib/meta-marketing";
import { TrafficActionError, runTrafficAction, type TrafficLevel } from "@/lib/traffic-actions";
import { RECOMMENDATION_ALERT_KEY } from "@/lib/traffic-recommendations";
import { resolveSystemAlert } from "@/lib/system-alerts";

/** Aplicar (passa pelas mesmas travas dos botões) ou ignorar uma recomendação. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores aplicam recomendações." }, { status: 403 });
  const rec = await prisma.trafficRecommendation.findFirst({ where: { id: params.id, agencyId: membership.agencyId, status: "PENDING" } });
  if (!rec) return NextResponse.json({ error: "Recomendação não encontrada ou já resolvida." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const decision = body?.decision === "apply" ? "apply" : body?.decision === "done" ? "done" : "ignore";

  let note: string | null = null;
  if (decision === "apply") {
    try {
      if (rec.type === "PAUSE") note = await runTrafficAction({ agencyId: membership.agencyId, userId: session.user.id, level: rec.level as TrafficLevel, id: rec.targetId, action: "pause" });
      else if ((rec.type === "INCREASE_BUDGET" || rec.type === "DECREASE_BUDGET") && rec.suggestedBudgetCents) {
        note = await runTrafficAction({ agencyId: membership.agencyId, userId: session.user.id, level: rec.level as TrafficLevel, id: rec.targetId, action: "budget", dailyBudgetCents: rec.suggestedBudgetCents });
      } else return NextResponse.json({ error: "Esta recomendação não tem ação automática: marque como resolvida." }, { status: 400 });
    } catch (error) {
      if (error instanceof TrafficActionError || error instanceof MetaWriteError) return NextResponse.json({ error: error.message }, { status: 400 });
      throw error;
    }
  }
  await prisma.trafficRecommendation.update({
    where: { id: rec.id },
    data: { status: decision === "ignore" ? "IGNORED" : "APPLIED", resolvedAt: new Date(), resolvedByUserId: session.user.id, resultNote: note },
  });
  const pending = await prisma.trafficRecommendation.count({ where: { agencyId: membership.agencyId, status: "PENDING" } });
  if (!pending) await resolveSystemAlert(membership.agencyId, RECOMMENDATION_ALERT_KEY);
  return NextResponse.json({ ok: true, note });
}
