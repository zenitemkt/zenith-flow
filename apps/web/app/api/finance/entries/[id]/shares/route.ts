import { canActOnEntry } from "@/lib/finance-scope";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { financeEntriesCacheTag } from "@/lib/finance-cache";
import { ShareError } from "@/lib/finance-shares";
import { readEntryShares, replaceEntryShares } from "@/lib/finance-partners";

interface RouteParams {
  params: { id: string };
}

/**
 * Define de quem é o lançamento (um sócio ou dividido). Vale em qualquer
 * status, inclusive liquidado: muda só a quem o valor pertence, nunca o
 * valor — a regra de "imutável após conciliação" (seção 22) continua valendo
 * para valor e datas. Se o lançamento já foi estornado, o estorno acompanha
 * a mesma divisão (com sinal trocado).
 * Body: { shares: [{ partnerId, amount? }] } — lista vazia remove a divisão.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }
  const entry = await prisma.financeEntry.findUnique({
    where: { id: params.id },
    include: { reversedBy: { select: { id: true } } },
  });
  if (!entry || entry.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }
  // Particular de outro sócio: este login não vê nem altera.
  if (!(await canActOnEntry(membership.agencyId, session.user.id, entry.id))) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }
  if (entry.reversalOfId) {
    return NextResponse.json({ error: "Altere a divisão no lançamento original; o estorno acompanha." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  let finalShares;
  try {
    finalShares = (await readEntryShares(prisma, membership.agencyId, body?.shares ?? [], entry.amountCents)) ?? [];
  } catch (error) {
    if (error instanceof ShareError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await replaceEntryShares(tx, entry.id, finalShares);
    if (entry.reversedBy) {
      await replaceEntryShares(
        tx,
        entry.reversedBy.id,
        finalShares.map((s) => ({ ...s, amountCents: -s.amountCents })),
      );
    }
    await tx.auditLog.create({
      data: {
        agencyId: entry.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "finance_entry.shares_updated",
        resourceType: "finance_entry",
        resourceId: entry.id,
        metadata: { shares: finalShares.map((s) => ({ partnerId: s.partnerId, amountCents: s.amountCents })) },
      },
    });
  });

  revalidateTag(financeEntriesCacheTag(membership.agencyId));
  return NextResponse.json({ ok: true });
}
