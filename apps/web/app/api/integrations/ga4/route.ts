import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

/** Salva/atualiza o Measurement ID do GA4 (seção 37, Etapa 3) — dado público, não é OAuth. */
export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const measurementId = typeof body?.measurementId === "string" ? body.measurementId.trim() : "";
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
    return NextResponse.json({ error: "Measurement ID inválido — formato esperado: G-XXXXXXXXXX." }, { status: 400 });
  }

  await prisma.agency.update({
    where: { id: membership.agencyId },
    data: { ga4MeasurementId: measurementId },
  });

  return NextResponse.json({ ok: true });
}
