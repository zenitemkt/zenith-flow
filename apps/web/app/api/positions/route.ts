import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

/** Seção 20 do manual: "cargos" — catálogo simples, sem faixa salarial. */
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (!title) {
    return NextResponse.json({ error: "Informe o nome do cargo." }, { status: 400 });
  }

  const existing = await prisma.position.findFirst({ where: { agencyId: membership.agencyId, title } });
  if (existing) {
    return NextResponse.json({ error: "Já existe um cargo com esse nome." }, { status: 409 });
  }

  const position = await prisma.position.create({
    data: { agencyId: membership.agencyId, title, description },
  });

  return NextResponse.json({ id: position.id }, { status: 201 });
}
