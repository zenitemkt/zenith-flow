import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== "RESOLVED" && status !== "IGNORED") {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  const alert = await prisma.commercialAlert.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!alert) return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
  const now = new Date();
  await prisma.commercialAlert.update({
    where: { id: alert.id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" ? now : null,
      ignoredAt: status === "IGNORED" ? now : null,
    },
  });
  return NextResponse.json({ ok: true });
}
