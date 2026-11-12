import { canActOnEntry } from "@/lib/finance-scope";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isFinanceEntryEditable, reaisToCents } from "@/lib/finance";
import { financeEntriesCacheTag } from "@/lib/finance-cache";
import { prisma } from "@zenite-mkt/db";
import { splitProportionally } from "@/lib/finance-shares";
import { replaceEntryShares } from "@/lib/finance-partners";

interface RouteParams {
  params: { id: string };
}

/** Editar um lançamento — só permitido antes da liquidação (seção 22: "valores são imutáveis após conciliação"). */
export async function PATCH(request: Request, { params }: RouteParams) {
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
  // Particular de outro sócio: este login não vê nem altera.
  if (!(await canActOnEntry(membership.agencyId, session.user.id, entry.id))) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }
  if (!isFinanceEntryEditable(entry.status)) {
    return NextResponse.json(
      { error: "Este lançamento já foi liquidado — use o estorno para corrigir." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : entry.description;
  const amount = body?.amount !== undefined ? Number(body.amount) : entry.amountCents / 100;
  const dueDate = body?.dueDate ? new Date(body.dueDate) : entry.dueDate;

  if (!description) {
    return NextResponse.json({ error: "Descreva o lançamento." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }
  if (isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Data de vencimento inválida." }, { status: 400 });
  }

  const amountCents = reaisToCents(amount);
  await prisma.$transaction(async (tx) => {
    await tx.financeEntry.update({ where: { id: entry.id }, data: { description, amountCents, dueDate } });
    // Valor mudou: a divisão entre sócios acompanha na mesma proporção, para a soma continuar fechando.
    if (amountCents !== entry.amountCents) {
      const current = await tx.financeEntryShare.findMany({
        where: { financeEntryId: entry.id },
        select: { partnerId: true, amountCents: true },
        orderBy: { createdAt: "asc" },
      });
      if (current.length > 0) await replaceEntryShares(tx, entry.id, splitProportionally(amountCents, current));
    }
  });

  revalidateTag(financeEntriesCacheTag(membership.agencyId));
  return NextResponse.json({ ok: true });
}
