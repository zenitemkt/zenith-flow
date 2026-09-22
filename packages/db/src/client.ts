import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __zenitePrisma: PrismaClient | undefined;
}

/**
 * Next.js recarrega módulos a cada request em dev; sem esse cache global,
 * cada hot-reload abriria uma nova pool de conexões contra o Neon.
 */
export const prisma = global.__zenitePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__zenitePrisma = prisma;
}

export * from "@prisma/client";
