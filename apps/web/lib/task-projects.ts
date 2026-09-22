import { prisma, type Prisma } from "@zenite-mkt/db";

type Client = Prisma.TransactionClient | typeof prisma;

const CLIENT_TASKS_PROJECT_NAME = "Tarefas";
const INTERNAL_TASKS_PROJECT_NAME = "Tarefas internas";

/**
 * `Project` virou 100% interno/invisível a partir do Kanban unificado de
 * Operação — sem página, sem nav (ver docs/DECISIONS.md). Toda tarefa nova é
 * anexada a um projeto "guarda-chuva" por cliente (ou um único projeto
 * interno quando não há cliente), criado sob demanda — mesmo padrão
 * findFirst-ou-create já usado pro projeto "Cobrança" da régua de cobrança
 * (`apps/web/app/api/finance/entries/[id]/collection-task/route.ts`). Isso
 * preserva `FinanceEntry.projectId`/`VendorOrder`/Timesheets sem precisar
 * mudar nada nelas.
 */
export async function getOrCreateTaskProject(
  client: Client,
  agencyId: string,
  clientId: string | null,
): Promise<{ id: string }> {
  const name = clientId ? CLIENT_TASKS_PROJECT_NAME : INTERNAL_TASKS_PROJECT_NAME;

  const existing = await client.project.findFirst({ where: { agencyId, clientId, name } });
  if (existing) return existing;

  return client.project.create({ data: { agencyId, clientId, name } });
}
