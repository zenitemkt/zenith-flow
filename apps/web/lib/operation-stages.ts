import { prisma, type Prisma } from "@zenite-mkt/db";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Colunas customizáveis do balde "Fazendo" (pedido do usuário, 2026-09-07 —
 * ver docs/DECISIONS.md). Toda agência precisa de pelo menos uma pra o board
 * não ficar sem lugar pra colocar uma tarefa `EM_ANDAMENTO` — como a
 * funcionalidade nasceu depois de agências já existirem (sem seed no
 * signup), a primeira coluna é criada sob demanda na primeira visita ao
 * board, mesmo padrão de `getOrCreateTaskProject`.
 */
export async function getOrCreateDefaultOperationStage(client: Client, agencyId: string) {
  const existing = await client.operationStage.findFirst({
    where: { agencyId },
    orderBy: { order: "asc" },
  });
  if (existing) return existing;

  return client.operationStage.create({ data: { agencyId, name: "Fazendo", order: 0 } });
}
