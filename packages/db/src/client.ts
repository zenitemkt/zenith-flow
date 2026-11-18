import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __zenitePrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __zeniteModelWriteListener: ModelWriteListener | undefined;
}

/** Recebe o nome do model (ex.: "SocialPost") depois de uma escrita que alterou pelo menos uma linha. */
export type ModelWriteListener = (model: string) => Promise<void> | void;

const WRITE_ACTIONS = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]);

/**
 * Um único ouvinte de escritas (o app registra no boot). Usado para acordar os
 * crons externos sem consultar o banco a cada minuto — ver apps/web/lib/cron-wake.ts.
 * Fica no `global` para sobreviver ao hot-reload do Next em dev.
 */
export function setModelWriteListener(listener: ModelWriteListener | undefined) {
  global.__zeniteModelWriteListener = listener;
}

function createClient() {
  const client = new PrismaClient();
  // `$use` (middleware) mantém o tipo do PrismaClient intacto e também roda dentro de $transaction.
  client.$use(async (params, next) => {
    const result = await next(params);
    const listener = global.__zeniteModelWriteListener;
    if (listener && params.model && WRITE_ACTIONS.has(params.action)) {
      const count = (result as { count?: unknown } | null)?.count;
      // updateMany/deleteMany/createMany sem linhas afetadas não são mudança real.
      if (typeof count !== "number" || count > 0) {
        try {
          await listener(params.model);
        } catch (error) {
          console.error("model_write_listener_failed", params.model, error);
        }
      }
    }
    return result;
  });
  return client;
}

/**
 * Next.js recarrega módulos a cada request em dev; sem esse cache global,
 * cada hot-reload abriria uma nova pool de conexões contra o Neon.
 */
export const prisma = global.__zenitePrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__zenitePrisma = prisma;
}

export * from "@prisma/client";
