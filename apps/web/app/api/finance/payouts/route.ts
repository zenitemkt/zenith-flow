import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { reaisToCents } from "@/lib/finance";
import { startOfDayUTC } from "@/lib/dates";
import { monthKey, parseMonthKey } from "@/lib/partner-payouts";

/**
 * Registra um pagamento de repasse ao sócio (valor digitado por quem fez a
 * transferência). Pode haver vários no mesmo mês. Só administradores.
 * Body: { partnerId, month: "AAAA-MM", amount (reais), paidAt: "AAAA-MM-DD", note? }
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores registram o repasse." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const monthStart = parseMonthKey(body?.month);
  const partnerId = typeof body?.partnerId === "string" ? body.partnerId : "";
  const amount = Number(body?.amount);
  const paidAt = typeof body?.paidAt === "string" ? new Date(body.paidAt) : null;
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null;

  if (!monthStart) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Digite o valor que foi transferido." }, { status: 400 });
  if (!paidAt || isNaN(paidAt.getTime())) return NextResponse.json({ error: "Informe a data da transferência." }, { status: 400 });
  if (startOfDayUTC(paidAt) > new Date()) return NextResponse.json({ error: "A data não pode ser no futuro." }, { status: 400 });

  const partner = await prisma.financePartner.findUnique({ where: { id: partnerId } });
  if (!partner || partner.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Sócio não encontrado." }, { status: 404 });
  }

  const amountCents = reaisToCents(amount);
  const payout = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerPayout.create({
      data: { agencyId: membership.agencyId, partnerId: partner.id, month: monthStart, amountCents, paidAt, note, paidByUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "partner_payout.paid",
        resourceType: "partner_payout",
        resourceId: created.id,
        metadata: { partnerId: partner.id, month: monthKey(monthStart), amountCents },
      },
    });
    return created;
  });
  return NextResponse.json({ id: payout.id }, { status: 201 });
}
