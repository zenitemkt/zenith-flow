import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** REJEITADO e DESISTIU são terminais alcançáveis aqui; CONTRATADO tem rota própria (/convert), que também cria o Employee. */
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

  const candidate = await prisma.candidate.findUnique({ where: { id: params.id } });
  if (!candidate || candidate.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
  }
  if (candidate.status !== "EM_ANDAMENTO") {
    return NextResponse.json({ error: "Só é possível decidir sobre candidatos em andamento." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus === "REJEITADO" ? "REJEITADO" : body?.toStatus === "DESISTIU" ? "DESISTIU" : null;
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  if (!toStatus) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (toStatus === "REJEITADO" && !reason) {
    return NextResponse.json({ error: "Informe o motivo da rejeição." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidate.update({
      where: { id: candidate.id },
      data: { status: toStatus, rejectedReason: toStatus === "REJEITADO" ? reason : null },
    });
    await tx.candidateStatusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: "EM_ANDAMENTO",
        toStatus,
        reason,
        actorUserId: session.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
