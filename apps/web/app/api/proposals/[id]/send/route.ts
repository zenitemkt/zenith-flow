import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { PROPOSAL_TTL_MS } from "@/lib/proposals";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Mesmo padrão de envio adiado do NPS/eNPS: sem provedor de e-mail integrado ainda — o link público fica disponível pra copiar. */
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
  if (proposal.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Esta proposta já foi enviada." }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: "ENVIADA", sentAt: now, expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS) },
    });
    await tx.proposalStatusHistory.create({
      data: { proposalId: proposal.id, fromStatus: "RASCUNHO", toStatus: "ENVIADA", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "proposal.sent",
        resourceType: "proposal",
        resourceId: proposal.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
