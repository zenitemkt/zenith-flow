import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Ação manual de staff pra fechar uma proposta sem resposta — sem worker pra expirar sozinha por data (ver docs/DECISIONS.md). */
export async function POST(_request: Request, { params }: RouteParams) {
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
  if (proposal.status !== "ENVIADA" && proposal.status !== "VISUALIZADA") {
    return NextResponse.json({ error: "Só é possível expirar uma proposta enviada ou visualizada." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({ where: { id: proposal.id }, data: { status: "EXPIRADA" } });
    await tx.proposalStatusHistory.create({
      data: { proposalId: proposal.id, fromStatus: proposal.status, toStatus: "EXPIRADA", actorUserId: session.user.id },
    });
  });

  return NextResponse.json({ ok: true });
}
