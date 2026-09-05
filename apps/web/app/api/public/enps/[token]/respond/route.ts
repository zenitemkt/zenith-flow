import { NextResponse } from "next/server";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { token: string };
}

/**
 * Público, sem sessão. O ponto que implementa o anonimato de verdade: grava
 * a nota em `EnpsResponse` (sem employeeId nenhum) e marca o convite como
 * `RESPONDIDO` (sem nota nenhuma) como duas escritas separadas — nada aqui
 * liga uma coisa à outra além de terem acontecido na mesma requisição, e
 * isso não fica registrado em lugar nenhum depois de commitado.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const invite = await prisma.enpsInvite.findUnique({
    where: { token: params.token },
    include: { campaign: true },
  });

  if (!invite || invite.campaign.status === "RASCUNHO") {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }
  if (invite.campaign.status === "ENCERRADA") {
    return NextResponse.json({ error: "Esta pesquisa já foi encerrada." }, { status: 400 });
  }
  if (invite.status === "RESPONDIDO") {
    return NextResponse.json({ error: "Você já respondeu esta pesquisa." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const score = Number(body?.score);
  const comment = typeof body?.comment === "string" ? body.comment.trim() || null : null;

  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "Escolha uma nota de 0 a 10." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.enpsResponse.create({ data: { campaignId: invite.campaignId, score, comment } }),
    prisma.enpsInvite.update({ where: { id: invite.id }, data: { status: "RESPONDIDO", respondedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true });
}
