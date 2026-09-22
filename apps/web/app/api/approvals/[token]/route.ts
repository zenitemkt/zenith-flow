import { NextResponse } from "next/server";
import { prisma, type ApprovalStatus } from "@zenite-mkt/db";
import { applyApprovalDecision } from "@/lib/content-approval";

interface RouteParams {
  params: { token: string };
}

/**
 * Rota pública — sem sessão, sem portal (seção 18: "cliente aprova uma peça
 * por link/portal"). O único segredo é o token em si (curto, expira,
 * escopo mínimo: só decide aprovar/pedir ajuste nesta versão).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const approval = await prisma.contentApproval.findUnique({
    where: { token: params.token },
    include: { contentVersion: { include: { contentItem: true } } },
  });

  if (!approval) {
    return NextResponse.json({ error: "Link de aprovação inválido." }, { status: 404 });
  }
  if (approval.status !== "PENDENTE") {
    return NextResponse.json({ error: "Esta aprovação já foi respondida." }, { status: 409 });
  }
  if (approval.expiresAt < new Date()) {
    return NextResponse.json({ error: "Este link de aprovação expirou." }, { status: 410 });
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
    approvalId: approval.id,
    contentVersionId: approval.contentVersionId,
    decision,
    note,
    actorUserId: null,
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
