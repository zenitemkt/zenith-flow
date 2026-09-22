import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { parseTimelineSteps } from "@/lib/proposals";
import { prisma, Prisma } from "@zenite-mkt/db";

/** Estados finais — a proposta já foi decidida pelo cliente, não editamos mais. */
const LOCKED_STATUSES = ["ACEITA", "REJEITADA", "EXPIRADA"] as const;

interface RouteParams {
  params: { id: string };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Editável em qualquer status, exceto os finais (ACEITA/REJEITADA/EXPIRADA) —
 * o time pode ajustar valor/escopo/etapas mesmo depois de enviada, mas não
 * depois que o cliente já decidiu.
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
  if (LOCKED_STATUSES.includes(proposal.status as (typeof LOCKED_STATUSES)[number])) {
    return NextResponse.json({ error: "Esta proposta já foi decidida pelo cliente e não pode mais ser editada." }, { status: 400 });
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

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      name,
      content,
      valueCents,
      paymentTerms,
      timelineSteps: (timelineSteps as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  return NextResponse.json({ ok: true });
}
