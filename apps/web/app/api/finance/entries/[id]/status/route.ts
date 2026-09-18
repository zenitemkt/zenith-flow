import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionFinanceEntry } from "@/lib/finance";
import { financeEntriesCacheTag } from "@/lib/finance-cache";
import { endOfDayUTC } from "@/lib/dates";
import { prisma, type FinanceEntryStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

const VALID_STATUSES: FinanceEntryStatus[] = ["PENDENTE", "LIQUIDADO", "VENCIDO", "CANCELADO"];

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const entry = await prisma.financeEntry.findUnique({ where: { id: params.id } });
  if (!entry || entry.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as FinanceEntryStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!toStatus || !VALID_STATUSES.includes(toStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (!canTransitionFinanceEntry(entry.status, toStatus)) {
    return NextResponse.json({ error: "Transição de status não permitida." }, { status: 400 });
  }

  /**
   * O mês que conta pro fluxo de caixa é o da data em que o dinheiro
   * efetivamente entrou/saiu (settledDate), não o de criação/vencimento —
   * ex.: boleto enviado dia 28, cliente só paga dia 5 do mês seguinte, esse
   * recebimento conta no mês do dia 5 (pedido do usuário, 2026-09-18).
   * Por isso LIQUIDADO exige a data informada por quem está registrando.
   */
  let settledDate = entry.settledDate;
  if (toStatus === "LIQUIDADO") {
    const raw = typeof body?.settledDate === "string" ? new Date(body.settledDate) : null;
    if (!raw || isNaN(raw.getTime())) {
      return NextResponse.json({ error: "Informe a data em que o valor foi recebido/pago." }, { status: 400 });
    }
    if (endOfDayUTC(raw) > new Date()) {
      return NextResponse.json({ error: "A data não pode ser no futuro." }, { status: 400 });
    }
    settledDate = raw;
  }

  await prisma.$transaction(async (tx) => {
    await tx.financeEntry.update({
      where: { id: entry.id },
      data: { status: toStatus, settledDate },
    });
    await tx.financeEntryStatusHistory.create({
      data: {
        financeEntryId: entry.id,
        fromStatus: entry.status,
        toStatus,
        reason,
        actorUserId: session.user.id,
      },
    });
  });

  revalidateTag(financeEntriesCacheTag(membership.agencyId));
  return NextResponse.json({ ok: true });
}
