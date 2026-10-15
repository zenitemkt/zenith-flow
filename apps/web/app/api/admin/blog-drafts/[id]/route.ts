import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

interface RouteParams {
  params: { id: string };
}

function text(value: unknown, maxLength = 20_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const draft = await prisma.blogDraft.findFirst({
    where: { id: params.id, agencyId: membership.agencyId },
    include: { comments: { orderBy: { createdAt: "desc" } } },
  });
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  return NextResponse.json({ draft });
}

/** Edição manual do texto/SEO antes de aprovar — só admin, pela tela. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem editar rascunhos." }, { status: 403 });
  }

  const draft = await prisma.blogDraft.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  if (draft.status !== "PENDING") {
    return NextResponse.json({ error: "Só rascunhos pendentes podem ser editados." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const data: Record<string, string | null> = {};
  for (const field of ["title", "excerpt", "content", "seoTitle", "focusKeyword", "category", "cover"] as const) {
    const value = text(body?.[field], field === "content" ? 50_000 : 300);
    if (value !== null) data[field] = value;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });

  await prisma.blogDraft.update({ where: { id: draft.id }, data });
  return NextResponse.json({ ok: true });
}
