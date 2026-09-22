import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Conteúdo só é editável enquanto RASCUNHO — depois de enviada, o cliente já pode ter visto. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
  if (!proposal || proposal.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }
  if (proposal.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Só é possível editar enquanto a proposta está em rascunho." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  const content = optionalString(body?.content);
  if (!name || !content) {
    return NextResponse.json({ error: "Nome e conteúdo são obrigatórios." }, { status: 400 });
  }
  const valueRaw = body?.value;
  const valueCents =
    valueRaw === null || valueRaw === undefined || valueRaw === "" ? null : Math.round(Number(valueRaw) * 100);

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { name, content, valueCents },
  });

  return NextResponse.json({ ok: true });
}
