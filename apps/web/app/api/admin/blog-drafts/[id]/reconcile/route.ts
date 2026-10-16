import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { loadGithubRef, listExistingBlogSlugs } from "@/lib/content-automation-connection";

interface RouteParams {
  params: { id: string };
}

/**
 * Corrige um caso raro: `publishBlogDraft` commitou tudo no GitHub com
 * sucesso, mas a atualização de status pra APPROVED falhou logo em seguida
 * (ex.: hiccup de conexão com o Neon entre os dois awaits), deixando o
 * rascunho preso em PENDING mesmo com o artigo já publicado de verdade.
 * Só marca APPROVED quando confirma que o slug já existe no repositório —
 * nunca assume, sempre confere a fonte real antes.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem fazer isso." }, { status: 403 });
  }

  const draft = await prisma.blogDraft.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  if (draft.status !== "PENDING") {
    return NextResponse.json({ error: "Só rascunhos pendentes podem ser reconciliados." }, { status: 400 });
  }

  let ref;
  try {
    ref = await loadGithubRef(membership.agencyId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conexão não configurada." }, { status: 400 });
  }
  const existingSlugs = await listExistingBlogSlugs(ref);
  if (!existingSlugs.includes(draft.slug)) {
    return NextResponse.json({ error: `O slug "${draft.slug}" não existe no repositório — este rascunho não foi publicado de verdade, não há o que reconciliar.` }, { status: 409 });
  }

  await prisma.blogDraft.update({ where: { id: draft.id }, data: { status: "APPROVED", reviewedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
