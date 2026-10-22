import { NextResponse } from "next/server";
import { prisma, type BlogDraftStatus } from "@zenite-mkt/db";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";
import { loadGithubRef, listExistingBlogSlugs } from "@/lib/content-automation-connection";
import { validateBlogDraft } from "@/lib/blog-validation";

function text(value: unknown, maxLength = 20_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

const VALID_STATUS: BlogDraftStatus[] = ["PENDING", "APPROVED", "REJECTED"];

/** Lista rascunhos (tela de Automações no Zenite Flow). */
export async function GET(request: Request) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status")?.toUpperCase();
  const status = VALID_STATUS.includes(statusParam as BlogDraftStatus) ? (statusParam as BlogDraftStatus) : undefined;

  const drafts = await prisma.blogDraft.findMany({
    where: { agencyId: actor.agencyId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: { comments: { orderBy: { createdAt: "desc" } } },
    take: 50,
  });
  return NextResponse.json({ drafts });
}

/**
 * Cria um rascunho novo — roda a validação mecânica e, se passar, grava
 * como PENDING. Nunca publica sozinho (decisão revisada em 2026-10-15: só a
 * rota /approve publica de verdade, acionada por um humano na tela).
 */
export async function POST(request: Request) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const slug = text(body?.slug, 160) ?? "";
  const title = text(body?.title, 200) ?? "";
  const excerpt = text(body?.excerpt, 300) ?? "";
  const content = text(body?.content) ?? "";
  const seoTitle = text(body?.seoTitle, 100) ?? title;
  const focusKeyword = text(body?.focusKeyword, 100);
  const category = text(body?.category, 60);
  const cover = text(body?.cover, 40);
  const origin = text(body?.origin, 20) ?? "manual";
  const suggestedCoverSearchTerm = text(body?.coverSearchTerm, 200);
  const suggestedRelated = Array.isArray(body?.related)
    ? body.related.filter((item: unknown): item is string => typeof item === "string").slice(0, 3)
    : undefined;
  const suggestedFaq = Array.isArray(body?.faq)
    ? (body.faq as unknown[])
        .filter((item): item is { q: string; a: string } => typeof item === "object" && item !== null && typeof (item as any).q === "string" && typeof (item as any).a === "string")
        .slice(0, 8)
    : undefined;

  let ref;
  try {
    ref = await loadGithubRef(actor.agencyId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conexão não configurada." }, { status: 400 });
  }
  const existingSlugs = await listExistingBlogSlugs(ref);

  const isRefresh = origin === "refresh";
  const issues = validateBlogDraft({ slug, title, excerpt, content, seoTitle, focusKeyword, category, cover, existingSlugs, isRefresh });
  if (issues.length > 0) return NextResponse.json({ error: "Rascunho não passou na validação mecânica.", issues }, { status: 422 });

  const data = {
    title,
    excerpt,
    content,
    seoTitle,
    focusKeyword,
    category,
    cover,
    origin,
    status: "PENDING" as const,
    reviewedAt: null,
    suggestedCoverSearchTerm,
    ...(suggestedRelated !== undefined ? { suggestedRelated } : {}),
    ...(suggestedFaq !== undefined ? { suggestedFaq } : {}),
  };
  // "refresh" reaproveita o mesmo artigo/slug (preserva a data original na
  // publicação — ver blog-publish.ts) em vez de criar outro registro, já que
  // slug é único por agência mesmo entre status diferentes.
  const draft = isRefresh
    ? await prisma.blogDraft.upsert({
        where: { agencyId_slug: { agencyId: actor.agencyId, slug } },
        create: { agencyId: actor.agencyId, slug, ...data },
        update: data,
      })
    : await prisma.blogDraft.create({ data: { agencyId: actor.agencyId, slug, ...data } });
  return NextResponse.json({ id: draft.id, status: draft.status }, { status: 201 });
}
