import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";

interface RouteParams {
  params: { id: string };
}

function text(value: unknown, maxLength = 20_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export async function GET(request: Request, { params }: RouteParams) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const draft = await prisma.blogDraft.findFirst({
    where: { id: params.id, agencyId: actor.agencyId },
    include: { comments: { orderBy: { createdAt: "desc" } } },
  });
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  return NextResponse.json({ draft });
}

/**
 * Edição do texto/SEO antes de aprovar — tanto o admin (pela tela) quanto o
 * agente (reescrevendo em resposta a um comentário aberto, seção "revisions"
 * do blueprint) usam esta mesma rota. Admin usa cookie de sessão; agente usa
 * `x-draft-agent-key`. Um `resolveCommentId`+`agentReply` opcional marca o
 * pedido de alteração como atendido na mesma chamada.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (actor.actor === "admin") {
    const { membership } = await requireSessionAndMembership();
    if (!membership || !canManageIntegrations(membership.role)) {
      return NextResponse.json({ error: "Apenas administradores podem editar rascunhos." }, { status: 403 });
    }
  }

  const draft = await prisma.blogDraft.findFirst({ where: { id: params.id, agencyId: actor.agencyId } });
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  if (draft.status !== "PENDING") {
    return NextResponse.json({ error: "Só rascunhos pendentes podem ser editados." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  for (const field of ["title", "excerpt", "content", "seoTitle", "focusKeyword", "category", "cover"] as const) {
    const value = text(body?.[field], field === "content" ? 50_000 : 300);
    if (value !== null) data[field] = value;
  }
  const suggestedCoverSearchTerm = text(body?.coverSearchTerm, 200);
  if (suggestedCoverSearchTerm !== null) data.suggestedCoverSearchTerm = suggestedCoverSearchTerm;
  if (Array.isArray(body?.related)) {
    data.suggestedRelated = body.related.filter((item: unknown): item is string => typeof item === "string").slice(0, 3);
  }
  if (Array.isArray(body?.faq)) {
    data.suggestedFaq = (body.faq as unknown[])
      .filter((item): item is { q: string; a: string } => typeof item === "object" && item !== null && typeof (item as any).q === "string" && typeof (item as any).a === "string")
      .slice(0, 8);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });

  await prisma.blogDraft.update({ where: { id: draft.id }, data });

  const resolveCommentId = text(body?.resolveCommentId, 60);
  const agentReply = text(body?.agentReply, 2000);
  if (resolveCommentId) {
    await prisma.blogDraftComment.updateMany({
      where: { id: resolveCommentId, draftId: draft.id },
      data: { status: "done", agentReply, resolvedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
