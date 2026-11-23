import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { loadGithubRef, listExistingBlogSlugs } from "@/lib/content-automation-connection";
import { VALID_BLOG_CATEGORIES, VALID_COVER_KEYS } from "@/lib/blog-validation";

function text(value: unknown, maxLength = 20_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

/**
 * Registra no histórico um artigo que já foi publicado por fora da esteira
 * normal (ex.: publicação extraordinária feita direto no repositório do
 * site, fora da rotina do agente). Nunca escreve no GitHub — só confere que
 * o slug já existe lá (mesma trava de segurança do reconcile) e grava o
 * registro com a data real de publicação informada por quem está registrando,
 * em vez de assumir "agora".
 */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem registrar uma publicação manual." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = text(body?.slug, 160) ?? "";
  const title = text(body?.title, 200) ?? "";
  const excerpt = text(body?.excerpt, 300);
  const content = text(body?.content) ?? "Publicado diretamente no repositório do site, fora desta tela.";
  const category = text(body?.category, 60);
  const cover = text(body?.cover, 40);
  const focusKeyword = text(body?.focusKeyword, 100);
  const publishedAtRaw = text(body?.publishedAt, 40);

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "Slug inválido — minúsculo, só letras/números separados por hífen." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Informe o título." }, { status: 400 });
  if (!category || !(VALID_BLOG_CATEGORIES as readonly string[]).includes(category)) return NextResponse.json({ error: `Categoria inválida — use uma de: ${VALID_BLOG_CATEGORIES.join(", ")}` }, { status: 400 });
  if (!cover || !(VALID_COVER_KEYS as readonly string[]).includes(cover)) return NextResponse.json({ error: `Capa inválida — use uma de: ${VALID_COVER_KEYS.join(", ")}` }, { status: 400 });
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();
  if (Number.isNaN(publishedAt.getTime())) return NextResponse.json({ error: "Data de publicação inválida." }, { status: 400 });

  let ref;
  try {
    ref = await loadGithubRef(membership.agencyId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conexão não configurada." }, { status: 400 });
  }
  const existingSlugs = await listExistingBlogSlugs(ref);
  if (!existingSlugs.includes(slug)) {
    return NextResponse.json({ error: `O slug "${slug}" não existe no repositório — confira se digitou certo antes de registrar.` }, { status: 409 });
  }

  const data = { title, excerpt: excerpt || title, content, category, cover, focusKeyword, status: "APPROVED" as const, reviewedAt: publishedAt };
  const draft = await prisma.blogDraft.upsert({
    where: { agencyId_slug: { agencyId: membership.agencyId, slug } },
    create: { agencyId: membership.agencyId, slug, origin: "manual", ...data },
    update: data,
  });
  await prisma.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "blog_draft.manual_record", resourceType: "blog_draft", resourceId: draft.id, metadata: { slug, publishedAt: publishedAt.toISOString() } } });
  return NextResponse.json({ ok: true, id: draft.id });
}
