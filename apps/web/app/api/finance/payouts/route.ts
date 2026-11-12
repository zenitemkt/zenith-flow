import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { loadFinanceViewer } from "@/lib/finance-scope";
import { monthKey, parseMonthKey, partnerPayoutDue } from "@/lib/partner-payouts";

/**
 * Repasse do fechamento: marca como pago (ou volta a pendente) o que a
 * agência deve a um sócio no mês. O valor é calculado aqui, nunca vem do
 * navegador. Só administradores.
 * Body: { partnerId, month: "AAAA-MM", paid: boolean }
 */
export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores registram o repasse." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const monthStart = parseMonthKey(body?.month);
  const partnerId = typeof body?.partnerId === "string" ? body.partnerId : "";
  const paid = body?.paid === true;
  if (!monthStart) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  const partner = await prisma.financePartner.findUnique({ where: { id: partnerId } });
  if (!partner || partner.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Sócio não encontrado." }, { status: 404 });
  }

  const audit = (action: string, metadata: Record<string, unknown>) =>
    prisma.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action,
        resourceType: "finance_partner",
        resourceId: partner.id,
        metadata: { month: monthKey(monthStart), ...metadata },
      },
    });

  if (!paid) {
    await prisma.partnerPayout.deleteMany({ where: { partnerId: partner.id, month: monthStart } });
    await audit("partner_payout.reopened", {});
    return NextResponse.json({ ok: true, paid: false });
  }

  const viewer = await loadFinanceViewer(membership.agencyId, session.user.id);
  const amountCents = await partnerPayoutDue(membership.agencyId, viewer, partner.id, monthStart);
  if (amountCents <= 0) {
    return NextResponse.json({ error: "Não há valor recebido da Zenite para repassar neste mês." }, { status: 400 });
  }
  // upsert: clicar de novo em "Pago" atualiza o valor registrado (entrou recebimento depois da baixa).
  await prisma.partnerPayout.upsert({
    where: { partnerId_month: { partnerId: partner.id, month: monthStart } },
    create: { agencyId: membership.agencyId, partnerId: partner.id, month: monthStart, amountCents, paidByUserId: session.user.id },
    update: { amountCents, paidAt: new Date(), paidByUserId: session.user.id },
  });
  await audit("partner_payout.paid", { amountCents });
  return NextResponse.json({ ok: true, paid: true, amountCents });
}
