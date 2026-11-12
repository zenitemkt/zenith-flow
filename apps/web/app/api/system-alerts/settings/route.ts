import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { SYSTEM_ALERT_TYPES } from "@/lib/system-alerts";

/** Liga/desliga tipos de alerta da agência. Corpo: { disabledTypes: string[] }. */
export async function PUT(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const valid = new Set<string>(SYSTEM_ALERT_TYPES.map((t) => t.id));
  const disabledTypes = Array.isArray(body?.disabledTypes) ? (body.disabledTypes as unknown[]).filter((t): t is string => typeof t === "string" && valid.has(t)) : null;
  if (!disabledTypes) return NextResponse.json({ error: "disabledTypes obrigatório." }, { status: 400 });
  await prisma.systemAlertSettings.upsert({
    where: { agencyId: membership.agencyId },
    create: { agencyId: membership.agencyId, disabledTypes },
    update: { disabledTypes },
  });
  return NextResponse.json({ ok: true });
}
