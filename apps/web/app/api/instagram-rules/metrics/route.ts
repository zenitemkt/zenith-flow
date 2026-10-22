import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";

/** Painel de métricas (Blueprint, seção 4.6) — enviadas, lidas, clicaram, sem regra, falharam, últimos 30 dias. */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId") ?? "";
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const logs = await prisma.instagramAutomationLog.findMany({
    where: { agencyId: membership.agencyId, clientId, createdAt: { gte: since } },
    select: { status: true, readAt: true, clickedAt: true },
  });

  const sent = logs.filter((l) => l.status === "sent");
  const read = sent.filter((l) => l.readAt !== null).length;
  const clicked = sent.filter((l) => l.clickedAt !== null).length;
  const noMatch = logs.filter((l) => l.status === "no_match").length;
  const failed = logs.filter((l) => l.status === "failed").length;

  return NextResponse.json({
    total: logs.length,
    sent: sent.length,
    readPct: sent.length > 0 ? Math.round((read / sent.length) * 100) : 0,
    clickedPct: sent.length > 0 ? Math.round((clicked / sent.length) * 100) : 0,
    noMatch,
    failed,
  });
}
