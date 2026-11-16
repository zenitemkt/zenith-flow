import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";

/**
 * Zera os lançamentos do Financeiro da agência (fim da fase de testes): lançamentos, estornos,
 * histórico de status, divisões entre sócios e repasses pagos. Categorias, sócios e
 * configurações ficam. Só admin, com confirmação explícita.
 */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageTeam(membership.role)) return NextResponse.json({ error: "Só administradores." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.confirm !== "ZERAR") return NextResponse.json({ error: "Confirmação ausente." }, { status: 400 });
  const agencyId = membership.agencyId;

  const result = await prisma.$transaction(async (tx) => {
    const payouts = await tx.partnerPayout.deleteMany({ where: { agencyId } });
    const reversals = await tx.financeEntry.deleteMany({ where: { agencyId, reversalOfId: { not: null } } });
    const entries = await tx.financeEntry.deleteMany({ where: { agencyId } });
    await tx.auditLog.create({
      data: {
        agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "finance.reset",
        resourceType: "agency",
        resourceId: agencyId,
        metadata: { entries: entries.count + reversals.count, payouts: payouts.count },
      },
    });
    return { entries: entries.count + reversals.count, payouts: payouts.count };
  });
  return NextResponse.json({ ok: true, ...result });
}
