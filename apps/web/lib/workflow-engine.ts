import { Prisma, prisma } from "@zenite-mkt/db";
import { getOrCreateTaskProject } from "@/lib/task-projects";
import { interpolate, type ConditionOperator, type WorkflowStep } from "@/lib/workflows";

type JsonPayload = Record<string, unknown>;

function evaluateCondition(step: Extract<WorkflowStep, { type: "CONDICAO" }>, payload: JsonPayload): boolean {
  const actual = payload[step.field];
  if (step.operator === "exists") return actual !== null && actual !== undefined && actual !== "";
  if (step.operator === "not_exists") return actual === null || actual === undefined || actual === "";
  if (actual === null || actual === undefined) return false;

  const actualStr = String(actual);
  const actualNum = typeof actual === "number" ? actual : Number(actual);
  const expectedNum = Number(step.value);
  const bothNumeric = step.value.trim() !== "" && Number.isFinite(actualNum) && Number.isFinite(expectedNum);

  const op: ConditionOperator = step.operator;
  if (op === "eq") return bothNumeric ? actualNum === expectedNum : actualStr === step.value;
  if (op === "ne") return bothNumeric ? actualNum !== expectedNum : actualStr !== step.value;
  if (op === "gt") return bothNumeric && actualNum > expectedNum;
  if (op === "gte") return bothNumeric && actualNum >= expectedNum;
  if (op === "lt") return bothNumeric && actualNum < expectedNum;
  if (op === "lte") return bothNumeric && actualNum <= expectedNum;
  if (op === "contains") return actualStr.toLowerCase().includes(step.value.toLowerCase());
  return false;
}

/**
 * Ações mapeiam pra capacidades que já existem no produto — sem e-mail/
 * WhatsApp/tag (seções 41 e "tag" dependem de infra/modelo que não existe
 * ainda) e sem "recalcular" nesta fatia (ver docs/DECISIONS.md).
 */
async function executeAction(
  agencyId: string,
  step: Extract<WorkflowStep, { type: "ACAO" }>,
  payload: JsonPayload,
): Promise<JsonPayload> {
  if (step.action === "create_task") {
    const clientId = typeof payload.clientId === "string" ? payload.clientId : null;
    const task = await prisma.$transaction(async (tx) => {
      const project = await getOrCreateTaskProject(tx, agencyId, clientId);
      const created = await tx.task.create({
        data: {
          projectId: project.id,
          title: interpolate(step.title, payload),
          description: step.description ? interpolate(step.description, payload) : null,
        },
      });
      await tx.taskStatusHistory.create({ data: { taskId: created.id, toStatus: "BACKLOG" } });
      return created;
    });
    return { taskId: task.id };
  }

  if (step.action === "add_lead_note") {
    const leadId = typeof payload.leadId === "string" ? payload.leadId : null;
    if (!leadId) {
      throw new Error("Payload deste gatilho não tem leadId — ação 'Adicionar nota ao lead' não se aplica.");
    }
    const note = await prisma.leadNote.create({ data: { leadId, body: interpolate(step.body, payload) } });
    return { noteId: note.id };
  }

  if (step.action === "webhook") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(step.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Webhook respondeu ${response.status}.`);
      return { status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Ação desconhecida.");
}

/**
 * Executa a run a partir do passo atual até bater em ESPERA, CONCLUIDO ou
 * FALHOU. Roda inline, na mesma requisição que disparou o gatilho — sem
 * fila/worker, uma automação lenta (ex.: webhook) atrasa a ação original
 * (por isso o timeout curto no webhook). Sem retry/backoff real (seção 40
 * pede, mas dependeria da fila que não existe) — falhou, falhou, fica
 * registrado em `WorkflowStepRun.error` pra alguém investigar.
 */
async function advanceRun(runId: string): Promise<void> {
  const run = await prisma.workflowRun.findUniqueOrThrow({
    where: { id: runId },
    include: { workflowVersion: { include: { workflow: true } } },
  });
  if (run.status !== "EXECUTANDO" && run.status !== "AGUARDANDO") return;

  const steps = run.workflowVersion.steps as unknown as WorkflowStep[];
  const payload = run.payload as JsonPayload;
  const agencyId = run.workflowVersion.workflow.agencyId;
  let index = run.status === "AGUARDANDO" ? run.currentStepIndex + 1 : run.currentStepIndex;

  if (run.status === "AGUARDANDO") {
    await prisma.workflowRun.update({ where: { id: run.id }, data: { status: "EXECUTANDO", resumeAt: null } });
  }

  while (index < steps.length) {
    const step = steps[index]!;
    const stepRun = await prisma.workflowStepRun.create({
      data: { workflowRunId: run.id, stepIndex: index, stepType: step.type, input: step as unknown as Prisma.InputJsonValue },
    });

    if (step.type === "CONDICAO") {
      const passed = evaluateCondition(step, payload);
      await prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { output: { passed }, finishedAt: new Date() } });
      if (!passed) {
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: { status: "CONCLUIDO", currentStepIndex: index, finishedAt: new Date() },
        });
        return;
      }
      index += 1;
      continue;
    }

    if (step.type === "ESPERA") {
      const resumeAt = new Date(Date.now() + step.minutes * 60_000);
      await prisma.workflowStepRun.update({
        where: { id: stepRun.id },
        data: { output: { resumeAt: resumeAt.toISOString() }, finishedAt: new Date() },
      });
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "AGUARDANDO", currentStepIndex: index, resumeAt },
      });
      return;
    }

    try {
      const output = await executeAction(agencyId, step, payload);
      await prisma.workflowStepRun.update({
        where: { id: stepRun.id },
        data: { output: output as Prisma.InputJsonValue, finishedAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      await prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { error: message, finishedAt: new Date() } });
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "FALHOU", currentStepIndex: index, finishedAt: new Date() },
      });
      return;
    }
    index += 1;
  }

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { status: "CONCLUIDO", currentStepIndex: index, finishedAt: new Date() },
  });
}

/**
 * Ponto de entrada chamado pelas rotas que já existem no produto (nunca um
 * `outbox_events` formal). **Nunca lança** — uma automação com bug jamais
 * pode quebrar a ação principal (criar lead, concluir tarefa etc.) que a
 * disparou; erros ficam só em `WorkflowStepRun.error`/console, nunca
 * propagam pro chamador.
 */
export async function fireWorkflowTrigger(
  agencyId: string,
  event: string,
  subjectType: string,
  subjectId: string,
  payload: JsonPayload,
): Promise<void> {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { agencyId, triggerEvent: event, status: "ATIVO" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    for (const workflow of workflows) {
      const version = workflow.versions[0];
      if (!version) continue;
      const run = await prisma.workflowRun.create({
        data: {
          workflowVersionId: version.id,
          subjectType,
          subjectId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
      await advanceRun(run.id);
    }
  } catch (error) {
    console.error(`[workflow-engine] falha ao disparar gatilho "${event}" para agência ${agencyId}:`, error);
  }
}

/** "Processar automações pendentes" (botão manual, mesmo padrão de Rotinas/Recorrências — sem cron real). */
export async function processPendingWorkflowRuns(agencyId: string): Promise<{ processed: number }> {
  const dueRuns = await prisma.workflowRun.findMany({
    where: { status: "AGUARDANDO", resumeAt: { lte: new Date() }, workflowVersion: { workflow: { agencyId } } },
    select: { id: true },
  });
  for (const run of dueRuns) {
    await advanceRun(run.id);
  }
  return { processed: dueRuns.length };
}
