import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { loadGithubRef, listExistingBlogSlugs } from "@/lib/content-automation-connection";
import { validateBlogDraft } from "@/lib/blog-validation";
import { publishBlogDraft } from "@/lib/blog-publish";

interface RouteParams {
  params: { id: string };
}

/**
 * Único caminho que publica de verdade — sempre acionado por um humano
 * (decisão revisada em 2026-10-15: nada publica sozinho por enquanto).
 * Revalida antes de publicar (o rascunho pode ter sido editado desde a
 * criação) e commita no repositório do site via GitHub Contents API.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem aprovar publicações." }, { status: 403 });
  }

  const draft = await prisma.blogDraft.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  if (draft.status !== "PENDING") {
    return NextResponse.json({ error: "Só rascunhos pendentes podem ser aprovados." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const related = Array.isArray(body?.related) ? body.related.filter((item: unknown): item is string => typeof item === "string").slice(0, 3) : [];
  const faq = Array.isArray(body?.faq)
    ? (body.faq as unknown[])
        .filter((item): item is { q: string; a: string } => typeof item === "object" && item !== null && typeof (item as any).q === "string" && typeof (item as any).a === "string")
        .slice(0, 8)
    : [];
  const coverSearchTerm = typeof body?.coverSearchTerm === "string" && body.coverSearchTerm.trim() ? body.coverSearchTerm.trim() : draft.focusKeyword ?? draft.title;

  let ref;
  try {
    ref = await loadGithubRef(membership.agencyId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conexão não configurada." }, { status: 400 });
  }

  const existingSlugs = await listExistingBlogSlugs(ref);
  const issues = validateBlogDraft({
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    content: draft.content,
    seoTitle: draft.seoTitle ?? draft.title,
    focusKeyword: draft.focusKeyword,
    category: draft.category,
    cover: draft.cover,
    existingSlugs,
  });
  if (issues.length > 0) {
    return NextResponse.json({ error: "Rascunho não passa mais na validação mecânica — ajuste antes de aprovar.", issues }, { status: 422 });
  }
  if (related.length === 0) {
    return NextResponse.json({ error: "Informe 1 a 3 slugs relacionados (campo related)." }, { status: 400 });
  }
  if (faq.length < 3) {
    return NextResponse.json({ error: "Informe pelo menos 3 perguntas de FAQ." }, { status: 400 });
  }

  try {
    const result = await publishBlogDraft(ref, { draft, coverSearchTerm, related, faq });
    await prisma.blogDraft.update({ where: { id: draft.id }, data: { status: "APPROVED", reviewedAt: new Date() } });
    return NextResponse.json({ ok: true, commitPaths: result.commitPaths });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao publicar." }, { status: 502 });
  }
}
