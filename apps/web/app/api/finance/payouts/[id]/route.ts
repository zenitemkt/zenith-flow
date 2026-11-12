import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { monthKey } from "@/lib/partner-payouts";

interface RouteParams {
  params: { id: string };
}

/** Remove um pagamento de repasse lançado por engano (fica no AuditLog). Só administradores. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores alteram o repasse." }, { status: 403 });
  }
  const payout = await prisma.partnerPayout.findUnique({ where: { id: params.id } });
  if (!payout || payout.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  }
  await prisma.$transaction([
    prisma.partnerPayout.delete({ where: { id: payout.id } }),
    prisma.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "partner_payout.removed",
        resourceType: "partner_payout",
        resourceId: payout.id,
        metadata: { partnerId: payout.partnerId, month: monthKey(payout.month), amountCents: payout.amountCents },
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
