import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * "Candidatos ficam em escopo separado e política de retenção" (regra
 * obrigatória, seção 20) — sem worker pra decair dado automaticamente, esta
 * é a ação manual: limpa nome/e-mail/telefone/notas, preserva a linha (e o
 * histórico de estágio/status) só pra estatística do funil.
 */
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

  const candidate = await prisma.candidate.findUnique({ where: { id: params.id } });
  if (!candidate || candidate.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
  }
  if (candidate.status === "EM_ANDAMENTO") {
    return NextResponse.json(
      { error: "Só é possível anonimizar candidatos já decididos (contratado, rejeitado ou desistiu)." },
      { status: 400 },
    );
  }
  if (candidate.anonymizedAt) {
    return NextResponse.json({ error: "Este candidato já foi anonimizado." }, { status: 409 });
  }

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      name: "Candidato anonimizado",
      email: null,
      phone: null,
      notes: null,
      anonymizedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
