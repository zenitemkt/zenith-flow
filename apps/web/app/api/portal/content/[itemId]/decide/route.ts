import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { applyApprovalDecision } from "@/lib/content-approval";
import { prisma, type ApprovalStatus } from "@zenite-mkt/db";

interface RouteParams {
  params: { itemId: string };
}

/**
 * Decisão de aprovação a partir do Portal do Cliente (sessão autenticada) —
 * mesma regra de negócio do link público (/api/approvals/:token), mas o
 * cliente já está logado, então identificamos a versão pendente pelo
 * ContentItem em vez de por token, e o autor da decisão fica registrado
 * de verdade (actorUserId), em vez de anônimo.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito ao portal do cliente." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: params.itemId },
    include: { client: true },
  });
  if (!item || item.client.workspaceId !== membership.workspaceId) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }

  const pendingApproval = await prisma.contentApproval.findFirst({
    where: { status: "PENDENTE", contentVersion: { contentItemId: item.id } },
    orderBy: { createdAt: "desc" },
  });
  if (!pendingApproval) {
    return NextResponse.json({ error: "Nenhuma aprovação pendente para esta peça." }, { status: 409 });
  }
  if (pendingApproval.expiresAt < new Date()) {
    return NextResponse.json({ error: "Este pedido de aprovação expirou." }, { status: 410 });
  }

  const body = await request.json().catch(() => null);
  const decision = body?.decision as ApprovalStatus | undefined;
  const note = typeof body?.note === "string" ? body.note.trim() || null : null;

  if (decision !== "APROVADO" && decision !== "AJUSTES_SOLICITADOS") {
    return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });
  }
  if (decision === "AJUSTES_SOLICITADOS" && !note) {
    return NextResponse.json({ error: "Descreva o ajuste necessário." }, { status: 400 });
  }

  const nextStatus = await applyApprovalDecision({
    approvalId: pendingApproval.id,
    contentVersionId: pendingApproval.contentVersionId,
    decision,
    note,
    actorUserId: session.user.id,
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
