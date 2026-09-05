import { NextResponse } from "next/server";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { token: string };
}

/** Público, sem sessão — mesma família do /api/approvals/[token] já existente para o link de aprovação de conteúdo. */
export async function POST(request: Request, { params }: RouteParams) {
  const recipient = await prisma.surveyRecipient.findUnique({
    where: { token: params.token },
    include: { campaign: true },
  });

  if (!recipient || recipient.campaign.status === "RASCUNHO") {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }
  if (recipient.campaign.status === "ENCERRADA") {
    return NextResponse.json({ error: "Esta pesquisa já foi encerrada." }, { status: 400 });
  }
  if (recipient.status === "RESPONDIDO") {
    return NextResponse.json({ error: "Você já respondeu esta pesquisa." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const score = Number(body?.score);
  const comment = typeof body?.comment === "string" ? body.comment.trim() || null : null;

  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "Escolha uma nota de 0 a 10." }, { status: 400 });
  }

  await prisma.surveyRecipient.update({
    where: { id: recipient.id },
    data: { status: "RESPONDIDO", score, comment, respondedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
