import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __zenithPrisma: PrismaClient | undefined;
}

/**
 * Next.js recarrega módulos a cada request em dev; sem esse cache global,
 * cada hot-reload abriria uma nova pool de conexões contra o Neon.
 */
export const prisma = global.__zenithPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__zenithPrisma = prisma;
}

export * from "@prisma/client";
