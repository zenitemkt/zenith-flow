import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { generateMonthlyCompetitorReport, monthFromKey, monthKey, previousClosedMonth } from "@/lib/competitor-reports";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  let month: Date;
  try {
    month = body?.month ? monthFromKey(String(body.month)) : previousClosedMonth();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mês inválido." }, { status: 400 });
  }
  if (month > previousClosedMonth()) return NextResponse.json({ error: "O relatório só pode ser fechado depois que o mês terminar." }, { status: 400 });
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: membership.agencyId }, select: { id: true } });
  if (!client || !(await canSeeClient(membership.agencyId, session.user.id, client.id))) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  try {
    const report = await generateMonthlyCompetitorReport({ clientId, agencyId: membership.agencyId, month, actorUserId: session.user.id, force: true });
    return NextResponse.json({ id: report.id, month: monthKey(report.month) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o relatório." }, { status: 502 });
  }
}
