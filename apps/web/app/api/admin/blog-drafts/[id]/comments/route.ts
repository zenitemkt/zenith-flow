import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

interface RouteParams {
  params: { id: string };
}

/** Admin pede ajuste num rascunho (pendente ou já aprovado) — o agente lê pelos abertos via /revisions. */
export async function POST(request: Request, { params }: RouteParams) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem solicitar alteração." }, { status: 403 });
  }

  const draft = await prisma.blogDraft.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const bodyText = typeof body?.body === "string" ? body.body.trim() : "";
  if (!bodyText) return NextResponse.json({ error: "Descreva o que precisa mudar." }, { status: 400 });

  const comment = await prisma.blogDraftComment.create({ data: { draftId: draft.id, body: bodyText.slice(0, 2000), status: "open" } });
  return NextResponse.json({ id: comment.id }, { status: 201 });
}
