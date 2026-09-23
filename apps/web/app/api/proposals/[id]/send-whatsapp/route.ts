import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { ensureProposalSent, buildProposalWhatsappMessage } from "@/lib/proposals-server";
import { normalizeWhatsappNumber, buildWhatsappLink } from "@/lib/whatsapp";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Não envia nada pelo servidor — só garante a transição RASCUNHO -> ENVIADA e devolve o link wa.me pronto pro client abrir. */
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
  const phoneRaw = typeof body?.phone === "string" ? body.phone : "";
  const phone = normalizeWhatsappNumber(phoneRaw);
  if (!phone) {
    return NextResponse.json({ error: "Informe um número de WhatsApp válido." }, { status: 400 });
  }

  const publicUrl = `${new URL(request.url).origin}/proposta/${proposal.token}`;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await ensureProposalSent(tx, proposal, session.user.id);
    await tx.proposal.update({
      where: { id: proposal.id },
      data: { recipientWhatsapp: phone, whatsappSentAt: now },
    });
  });

  return NextResponse.json({ ok: true, waLink: buildWhatsappLink(phone, buildProposalWhatsappMessage(publicUrl)) });
}
