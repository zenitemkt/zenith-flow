import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { collectionStageForDueDate, daysOverdue, COLLECTION_TASK_ELIGIBLE_STAGES } from "@/lib/collection-ladder";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

const COLLECTION_PROJECT_NAME = "Cobrança";

/**
 * Seção 28: "D+1... criar tarefa se valor relevante." Sem apps/worker ainda,
 * o gatilho é o botão manual — mesmo padrão de Rotinas/Health Score/Risco de
 * churn. Idempotente via `FinanceEntry.collectionTaskId` (@unique): uma vez
 * criada, o botão não aparece mais para este lançamento.
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

  const entry = await prisma.financeEntry.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!entry || entry.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }
  if (entry.type !== "RECEITA") {
    return NextResponse.json({ error: "Tarefa de cobrança só se aplica a contas a receber." }, { status: 400 });
  }
  if (entry.collectionTaskId) {
    return NextResponse.json({ error: "Já existe uma tarefa de cobrança para este lançamento." }, { status: 400 });
  }

  const stage = collectionStageForDueDate(entry.dueDate);
  if (!stage || !COLLECTION_TASK_ELIGIBLE_STAGES.includes(stage)) {
    return NextResponse.json(
      { error: "Este lançamento ainda não entrou em atraso o suficiente para gerar tarefa." },
      { status: 400 },
    );
  }

  const overdue = daysOverdue(entry.dueDate);

  const task = await prisma.$transaction(async (tx) => {
    let project = await tx.project.findFirst({
      where: { agencyId: membership.agencyId, clientId: entry.clientId, name: COLLECTION_PROJECT_NAME },
    });
    if (!project) {
      project = await tx.project.create({
        data: { agencyId: membership.agencyId, clientId: entry.clientId, name: COLLECTION_PROJECT_NAME },
      });
    }

    const clientLabel = entry.client ? ` — ${entry.client.name}` : "";
    const created = await tx.task.create({
      data: {
        projectId: project.id,
        title: `Cobrar: ${entry.description}${clientLabel} (${overdue} dia${overdue === 1 ? "" : "s"} de atraso)`,
        description: `Lançamento vencido em ${entry.dueDate.toLocaleDateString("pt-BR")}. Gerado pela régua de cobrança (seção 28).`,
        dueDate: new Date(),
      },
    });
    await tx.taskStatusHistory.create({
      data: { taskId: created.id, toStatus: "BACKLOG", actorUserId: session.user.id },
    });
    await tx.financeEntry.update({ where: { id: entry.id }, data: { collectionTaskId: created.id } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "finance_entry.collection_task_created",
        resourceType: "finance_entry",
        resourceId: entry.id,
        metadata: { taskId: created.id, stage },
      },
    });
    return created;
  });

  return NextResponse.json({ taskId: task.id }, { status: 201 });
}
