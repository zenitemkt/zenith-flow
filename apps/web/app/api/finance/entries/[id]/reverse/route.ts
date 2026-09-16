import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { financeEntriesCacheTag } from "@/lib/finance-cache";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Estorno — seção 22: "valores são imutáveis após conciliação; correção por
 * estorno/ajuste". Um lançamento LIQUIDADO nunca é editado; em vez disso,
 * cria-se um contra-lançamento (mesmo tipo, valor negativo) que cancela o
 * original nas somas de fluxo de caixa. O original permanece intacto e
 * rastreável via reversedBy.
 */
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

  const entry = await prisma.financeEntry.findUnique({
    where: { id: params.id },
    include: { reversedBy: true },
  });
  if (!entry || entry.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }
  if (entry.status !== "LIQUIDADO") {
    return NextResponse.json({ error: "Só lançamentos liquidados podem ser estornados." }, { status: 400 });
  }
  if (entry.reversedBy) {
    return NextResponse.json({ error: "Este lançamento já foi estornado." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;
  if (!reason) {
    return NextResponse.json({ error: "Descreva o motivo do estorno." }, { status: 400 });
  }

  const reversal = await prisma.$transaction(async (tx) => {
    const created = await tx.financeEntry.create({
      data: {
        agencyId: entry.agencyId,
        type: entry.type,
        status: "LIQUIDADO",
        description: `Estorno: ${entry.description}`,
        amountCents: -entry.amountCents,
        categoryId: entry.categoryId,
        clientId: entry.clientId,
        projectId: entry.projectId,
        competencyDate: new Date(),
        dueDate: new Date(),
        settledDate: new Date(),
        reversalOfId: entry.id,
        createdByUserId: session.user.id,
      },
    });
    await tx.financeEntryStatusHistory.create({
      data: { financeEntryId: created.id, toStatus: "LIQUIDADO", reason, actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: entry.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "finance_entry.reversed",
        resourceType: "finance_entry",
        resourceId: created.id,
        metadata: { originalEntryId: entry.id, reason },
      },
    });
    return created;
  });

  revalidateTag(financeEntriesCacheTag(membership.agencyId));
  return NextResponse.json({ id: reversal.id }, { status: 201 });
}
