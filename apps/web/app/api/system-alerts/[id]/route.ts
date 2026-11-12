import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";

/** Resolver, ignorar ou reabrir um alerta de sistema da própria agência. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== "RESOLVED" && status !== "IGNORED" && status !== "OPEN") return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  const updated = await prisma.systemAlert.updateMany({
    where: { id: params.id, agencyId: membership.agencyId },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null, autoResolved: false },
  });
  if (!updated.count) return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
