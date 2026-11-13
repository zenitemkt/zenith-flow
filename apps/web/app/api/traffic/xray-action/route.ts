import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { MetaWriteError } from "@/lib/meta-marketing";
import { TrafficActionError, runTrafficAction, type TrafficAction, type TrafficLevel } from "@/lib/traffic-actions";

/** Ativar, pausar ou ajustar verba (Tráfego - Raio X). Só administradores. */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores alteram campanhas." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const level = body?.level as TrafficLevel;
  const action = body?.action as TrafficAction;
  if (!["campaign", "adset", "ad"].includes(level) || !["pause", "activate", "budget"].includes(action) || typeof body?.id !== "string") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const summary = await runTrafficAction({
      agencyId: membership.agencyId,
      userId: session.user.id,
      level,
      id: body.id,
      action,
      dailyBudgetCents: typeof body.dailyBudget === "number" ? Math.round(body.dailyBudget * 100) : undefined,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    if (error instanceof TrafficActionError || error instanceof MetaWriteError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
