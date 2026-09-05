import { NextResponse } from "next/server";
import { isProposalExpired } from "@/lib/proposals";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { token: string };
}

/** Público, sem sessão — mesma família de /api/approvals/[token] e /api/public/survey/[token]/respond. */
export async function POST(request: Request, { params }: RouteParams) {
  const proposal = await prisma.proposal.findUnique({ where: { token: params.token } });

  if (!proposal || proposal.status === "RASCUNHO") {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }
  if (isProposalExpired(proposal)) {
    return NextResponse.json({ error: "Esta proposta expirou." }, { status: 400 });
  }
  if (proposal.status === "ACEITA" || proposal.status === "REJEITADA" || proposal.status === "EXPIRADA") {
    return NextResponse.json({ error: "Esta proposta já foi respondida." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const decision = body?.decision as "ACEITA" | "REJEITADA" | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (decision !== "ACEITA" && decision !== "REJEITADA") {
    return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });
  }
  if (decision === "REJEITADA" && !reason) {
    return NextResponse.json({ error: "Conte pra gente o motivo da recusa." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        status: decision,
        respondedAt: new Date(),
        rejectedReason: decision === "REJEITADA" ? reason : null,
      },
    });
    await tx.proposalStatusHistory.create({
      data: { proposalId: proposal.id, fromStatus: proposal.status, toStatus: decision, reason },
    });
  });

  return NextResponse.json({ ok: true, status: decision });
}
