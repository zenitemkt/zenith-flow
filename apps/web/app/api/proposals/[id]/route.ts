import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { parseTimelineSteps } from "@/lib/proposals";
import { prisma, Prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Editável em qualquer status, exceto ACEITA — a proposta aceita já virou
 * negócio fechado (gera recebível no Financeiro, avança o Pipeline), então
 * não reabrimos. Recusada/Expirada continuam editáveis de propósito (pedido
 * do usuário, 2026-09-27): cliente recusa, a equipe renegocia por fora e
 * ajusta a proposta antes de reenviar (ver `ensureProposalSent`). Toda
 * edição grava quem mudou e o que mudou em `AuditLog` — nunca lido antes
 * nesta rota, mesmo formato de `membership.updated`.
 */
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

  const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
  if (!proposal || proposal.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }
  if (proposal.status === "ACEITA") {
    return NextResponse.json({ error: "Esta proposta já foi aceita pelo cliente e não pode mais ser editada." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  const content = optionalString(body?.content);
  if (!name || !content) {
    return NextResponse.json({ error: "Nome e conteúdo são obrigatórios." }, { status: 400 });
  }
  const valueRaw = body?.value;
  const valueCents =
    valueRaw === null || valueRaw === undefined || valueRaw === "" ? null : Math.round(Number(valueRaw) * 100);
  const paymentTerms = optionalString(body?.paymentTerms);
  const timelineSteps = parseTimelineSteps(body?.timelineSteps);

  // Diff campo a campo pro log de auditoria — só entra quem realmente mudou.
  // Escopo e prazos podem ser longos, então viram só "alterado" no log (o
  // texto/lista inteiros não são gravados), diferente de nome/valor/forma de
  // pagamento, curtos o bastante pra valer registrar o antes e o depois.
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  if (proposal.name !== name) changed.name = { from: proposal.name, to: name };
  if (proposal.content !== content) changed.content = { from: "alterado", to: "alterado" };
  if (proposal.valueCents !== valueCents) changed.valueCents = { from: proposal.valueCents, to: valueCents };
  if (proposal.paymentTerms !== paymentTerms) changed.paymentTerms = { from: proposal.paymentTerms, to: paymentTerms };
  if (JSON.stringify(proposal.timelineSteps ?? null) !== JSON.stringify(timelineSteps ?? null)) {
    changed.timelineSteps = { from: "alterado", to: "alterado" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        name,
        content,
        valueCents,
        paymentTerms,
        timelineSteps: (timelineSteps as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
    if (Object.keys(changed).length > 0) {
      await tx.auditLog.create({
        data: {
          agencyId: membership.agencyId,
          actorUserId: session.user.id,
          actorType: "user",
          action: "proposal.updated",
          resourceType: "proposal",
          resourceId: proposal.id,
          metadata: {
            fields: Object.keys(changed),
            from: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.from])),
            to: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.to])),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageTeam(membership.role)) return NextResponse.json({ error: "Apenas administradores podem excluir propostas." }, { status: 403 });
  const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
  if (!proposal || proposal.agencyId !== membership.agencyId) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.proposal.delete({ where: { id: proposal.id } });
    if (proposal.opportunityId) {
      const latest = await tx.proposal.findFirst({ where: { opportunityId: proposal.opportunityId }, orderBy: { createdAt: "desc" }, select: { valueCents: true } });
      await tx.opportunity.updateMany({ where: { id: proposal.opportunityId, agencyId: membership.agencyId, status: "OPEN" }, data: { valueCents: latest?.valueCents ?? null } });
    }
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "proposal.deleted", resourceType: "proposal", resourceId: proposal.id, metadata: { name: proposal.name, opportunityId: proposal.opportunityId } } });
  });
  return NextResponse.json({ ok: true });
}
