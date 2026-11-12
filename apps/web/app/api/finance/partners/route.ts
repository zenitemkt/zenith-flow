import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { listFinancePartners } from "@/lib/finance-partners";

/** Sócios da agência para a divisão do financeiro. Ver a lista: equipe. Cadastrar: administradores. */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }
  // `?clientId=`: devolve junto a divisão padrão daquele cliente (cadastro do cliente, modo edição).
  const clientId = new URL(request.url).searchParams.get("clientId");
  const [partners, clientShares] = await Promise.all([
    listFinancePartners(membership.agencyId),
    clientId
      ? prisma.clientPartnerShare.findMany({
          where: { clientId, client: { agencyId: membership.agencyId } },
          select: { partnerId: true, amountCents: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);
  return NextResponse.json({ partners, clientShares });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem cadastrar sócios." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Informe o nome do sócio." }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "Nome muito longo." }, { status: 400 });

  const existing = await prisma.financePartner.findFirst({
    where: { agencyId: membership.agencyId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    // Mesmo nome de novo: reativa em vez de duplicar (também cobre clique duplo).
    if (!existing.active) await prisma.financePartner.update({ where: { id: existing.id }, data: { active: true } });
    return NextResponse.json({ id: existing.id }, { status: 200 });
  }

  const partner = await prisma.$transaction(async (tx) => {
    const created = await tx.financePartner.create({ data: { agencyId: membership.agencyId, name } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "finance_partner.created",
        resourceType: "finance_partner",
        resourceId: created.id,
        metadata: { name },
      },
    });
    return created;
  });
  return NextResponse.json({ id: partner.id }, { status: 201 });
}
