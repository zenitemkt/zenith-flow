import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { createEmployeeRecord } from "@/lib/employees-create";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** "Contratado" (seção 20) — mesma forma de conversão já usada em Lead -> Client: cria o registro do lado de cá numa transação e grava o vínculo permanente. */
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

  const candidate = await prisma.candidate.findUnique({ where: { id: params.id }, include: { job: true } });
  if (!candidate || candidate.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
  }
  if (candidate.status !== "EM_ANDAMENTO") {
    return NextResponse.json({ error: "Só é possível contratar candidatos em andamento." }, { status: 400 });
  }

  const employee = await prisma.$transaction(async (tx) => {
    const created = await createEmployeeRecord(
      {
        agencyId: membership.agencyId,
        userId: null,
        name: candidate.name,
        email: candidate.email,
        role: candidate.job.title,
        positionId: candidate.job.positionId,
        actorUserId: session.user.id,
      },
      tx,
    );
    await tx.candidate.update({
      where: { id: candidate.id },
      data: { status: "CONTRATADO", convertedEmployeeId: created.id },
    });
    await tx.candidateStatusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: "EM_ANDAMENTO",
        toStatus: "CONTRATADO",
        actorUserId: session.user.id,
      },
    });
    return created;
  });

  return NextResponse.json({ employeeId: employee.id }, { status: 201 });
}
