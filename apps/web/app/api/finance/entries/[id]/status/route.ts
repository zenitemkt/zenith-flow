import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionFinanceEntry } from "@/lib/finance";
import { financeEntriesCacheTag } from "@/lib/finance-cache";
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

  await prisma.$transaction(async (tx) => {
    await tx.financeEntry.update({
      where: { id: entry.id },
      data: {
        status: toStatus,
        settledDate: toStatus === "LIQUIDADO" ? new Date() : entry.settledDate,
      },
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
