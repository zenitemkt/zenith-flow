import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { reaisToCents, DESPESA_CATEGORY_NATURES } from "@/lib/finance";
import { financeEntriesCacheTag } from "@/lib/finance-cache";
import { prisma, type FinanceEntryType, type FinanceCategoryNature } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const VALID_TYPES: FinanceEntryType[] = ["RECEITA", "DESPESA"];

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const type = body?.type as FinanceEntryType | undefined;
  const description = optionalString(body?.description);
  const amount = Number(body?.amount);
  const competencyDate = new Date(body?.competencyDate);
  const dueDate = new Date(body?.dueDate);
  const categoryId = optionalString(body?.categoryId);
  const categoryName = optionalString(body?.categoryName);
  const categoryNatureRaw = body?.categoryNature as FinanceCategoryNature | undefined;
  const clientId = optionalString(body?.clientId);
  const projectId = optionalString(body?.projectId);

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Descreva o lançamento." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }
  if (isNaN(competencyDate.getTime()) || isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Datas inválidas." }, { status: 400 });
  }

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
  }
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Projeto inválido." }, { status: 400 });
    }
  }

  const entry = await prisma.$transaction(async (tx) => {
    let finalCategoryId = categoryId;
    if (!finalCategoryId && categoryName) {
      const nature: FinanceCategoryNature =
        type === "RECEITA"
          ? "RECEITA"
          : categoryNatureRaw && DESPESA_CATEGORY_NATURES.includes(categoryNatureRaw)
            ? categoryNatureRaw
            : "DESPESA_OPERACIONAL";
      const category = await tx.financeCategory.upsert({
        where: { agencyId_name_type: { agencyId: membership.agencyId, name: categoryName, type } },
        create: { agencyId: membership.agencyId, name: categoryName, type, nature },
        update: {},
      });
      finalCategoryId = category.id;
    }

    const created = await tx.financeEntry.create({
      data: {
        agencyId: membership.agencyId,
        type,
        description,
        amountCents: reaisToCents(amount),
        categoryId: finalCategoryId,
        clientId,
        projectId,
        competencyDate,
        dueDate,
        createdByUserId: session.user.id,
      },
    });
    await tx.financeEntryStatusHistory.create({
      data: { financeEntryId: created.id, toStatus: "PREVISTO", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "finance_entry.created",
        resourceType: "finance_entry",
        resourceId: created.id,
        metadata: { type, amountCents: created.amountCents },
      },
    });
    return created;
  });

  revalidateTag(financeEntriesCacheTag(membership.agencyId));
  return NextResponse.json({ id: entry.id }, { status: 201 });
}
