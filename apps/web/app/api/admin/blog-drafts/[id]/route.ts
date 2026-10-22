import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";
import { loadGithubRef, listExistingBlogSlugs } from "@/lib/content-automation-connection";
import { validateBlogDraft } from "@/lib/blog-validation";
import { publishBlogDraft } from "@/lib/blog-publish";

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
  if (draft.status === "REJECTED") {
    return NextResponse.json({ error: "Rascunho rejeitado não pode ser editado." }, { status: 400 });
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

  const updated = await prisma.blogDraft.update({ where: { id: draft.id }, data });

  // Seção "revisions" do Blueprint — se o artigo já está publicado, editar o
  // texto aqui não basta: precisa recommitar no site, senão a correção fica
  // só no banco e o ar continua com o texto antigo. Mantém a mesma foto
  // (skipCoverPhoto) já que normalmente é um ajuste pontual de texto.
  let republished: string[] | null = null;
  if (updated.status === "APPROVED") {
    let ref;
    try {
      ref = await loadGithubRef(actor.agencyId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Conexão não configurada." }, { status: 400 });
    }
    const existingSlugs = await listExistingBlogSlugs(ref);
    const issues = validateBlogDraft({
      slug: updated.slug,
      title: updated.title,
      excerpt: updated.excerpt,
      content: updated.content,
      seoTitle: updated.seoTitle ?? updated.title,
      focusKeyword: updated.focusKeyword,
      category: updated.category,
      cover: updated.cover,
      existingSlugs,
      isRefresh: true, // já publicado sob esse slug — a regra de "slug novo" não se aplica aqui
    });
    if (issues.length > 0) {
      return NextResponse.json({ error: "Edição não passa na validação mecânica.", issues }, { status: 422 });
    }
    const related = Array.isArray(updated.suggestedRelated) ? (updated.suggestedRelated as string[]) : [];
    const faq = Array.isArray(updated.suggestedFaq) ? (updated.suggestedFaq as { q: string; a: string }[]) : [];
    if (related.length === 0 || faq.length < 3) {
      return NextResponse.json({ error: "Rascunho sem related/faq suficientes salvos pra republicar — informe related (1-3) e faq (3+) nesta mesma edição." }, { status: 400 });
    }
    try {
      const result = await publishBlogDraft(ref, {
        draft: updated,
        coverSearchTerm: updated.suggestedCoverSearchTerm ?? updated.focusKeyword ?? updated.title,
        related,
        faq,
        skipCoverPhoto: true,
      });
      republished = result.commitPaths;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao republicar a correção." }, { status: 502 });
    }
  }

  const resolveCommentId = text(body?.resolveCommentId, 60);
  const agentReply = text(body?.agentReply, 2000);
  if (resolveCommentId) {
    await prisma.blogDraftComment.updateMany({
      where: { id: resolveCommentId, draftId: draft.id },
      data: { status: "done", agentReply, resolvedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, republished });
}
