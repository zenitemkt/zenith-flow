import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Seção 32.3: "concorrente quando informado... elegibilidade" — editável a qualquer momento, mais relevante enquanto ENCERRADO. */
export async function POST(request: Request, { params }: RouteParams) {
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

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const competitorNameRaw = body?.competitorName;
  const competitorName =
    typeof competitorNameRaw === "string" ? competitorNameRaw.trim() || null : client.competitorName;
  const reactivationEligible =
    typeof body?.reactivationEligible === "boolean" ? body.reactivationEligible : client.reactivationEligible;

  await prisma.client.update({
    where: { id: client.id },
    data: { competitorName, reactivationEligible },
  });

  return NextResponse.json({ ok: true });
}
