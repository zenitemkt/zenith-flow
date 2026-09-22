import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { splitEmailList } from "@/lib/proposals";
import { ensureProposalSent } from "@/lib/proposals-server";
import { sendProposalEmail, EmailNotConfiguredError } from "@/lib/email";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Dispara o e-mail via Resend e garante a transição RASCUNHO -> ENVIADA (idempotente com o WhatsApp). */
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

  const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
  if (!proposal || proposal.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }
  if (proposal.status === "ACEITA" || proposal.status === "REJEITADA" || proposal.status === "EXPIRADA") {
    return NextResponse.json({ error: "Esta proposta já foi decidida pelo cliente." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  const cc = splitEmailList(body?.cc);
  const bcc = splitEmailList(body?.bcc);

  const publicUrl = `${new URL(request.url).origin}/proposta/${proposal.token}`;

  try {
    await sendProposalEmail({ to, cc, bcc, proposal, publicUrl, agencyName: membership.agency.name });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o e-mail." }, { status: 502 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await ensureProposalSent(tx, proposal, session.user.id);
    await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        recipientEmail: to,
        recipientEmailCc: cc.length > 0 ? cc.join(", ") : null,
        recipientEmailBcc: bcc.length > 0 ? bcc.join(", ") : null,
        emailSentAt: now,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
