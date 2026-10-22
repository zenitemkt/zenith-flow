import { NextResponse } from "next/server";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";
import { loadGithubRef, listExistingBlogSlugs } from "@/lib/content-automation-connection";
import { validateBlogDraft } from "@/lib/blog-validation";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Dry run — roda só a validação mecânica (zero IA), nunca salva nada (Blueprint, seção 2.2, passo 3). */
export async function POST(request: Request) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const slug = text(body?.slug) ?? "";
  const title = text(body?.title) ?? "";
  const excerpt = text(body?.excerpt) ?? "";
  const content = text(body?.content) ?? "";

  let ref;
  try {
    ref = await loadGithubRef(actor.agencyId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conexão não configurada." }, { status: 400 });
  }
  const existingSlugs = await listExistingBlogSlugs(ref);

  const issues = validateBlogDraft({
    slug,
    title,
    excerpt,
    content,
    seoTitle: text(body?.seoTitle) ?? title,
    focusKeyword: text(body?.focusKeyword),
    category: text(body?.category),
    cover: text(body?.cover),
    existingSlugs,
    isRefresh: text(body?.origin) === "refresh",
  });

  return NextResponse.json({ valid: issues.length === 0, issues });
}
