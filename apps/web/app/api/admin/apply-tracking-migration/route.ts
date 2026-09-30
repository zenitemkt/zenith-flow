import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";

/**
 * Escape-hatch temporário: aplica a migration de `AdAccountConnection`
 * (packages/db/prisma/migrations/20260929120000_ad_account_connection) direto
 * no banco de produção, usando as credenciais que a própria Vercel já tem
 * configuradas — sem precisar do login da Neon, que ficou inacessível nesta
 * sessão (ver docs/STATUS.md de 2026-09-29). SQL idêntico ao gerado por
 * `prisma migrate diff` a partir do schema, só puramente aditivo (2 enums, 1
 * tabela nova, sem alterar nenhuma tabela existente).
 *
 * Depois de rodar isto com sucesso, IMPORTANTE: assim que houver acesso via
 * CLI ao Neon de novo, rodar (dentro de packages/db):
 *   npx prisma migrate resolve --applied 20260929120000_ad_account_connection
 * Isso sincroniza o histórico do Prisma (`_prisma_migrations`) com o que essa
 * rota já aplicou na marra — sem isso, um `prisma migrate deploy` futuro vai
 * tentar rodar esta migration de novo e falhar com "already exists".
 *
 * Remover esta rota inteira depois de usada uma vez — não é uma feature do
 * produto, é uma ferramenta de uma execução só.
 */

const STATEMENTS = [
  `CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE')`,
  `CREATE TYPE "AdConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR')`,
  `CREATE TABLE "ad_account_connection" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "externalAccountName" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "status" "AdConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_account_connection_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX "ad_account_connection_agencyId_idx" ON "ad_account_connection"("agencyId")`,
  `CREATE UNIQUE INDEX "ad_account_connection_agencyId_platform_key" ON "ad_account_connection"("agencyId", "platform")`,
  `ALTER TABLE "ad_account_connection" ADD CONSTRAINT "ad_account_connection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "ad_account_connection" ADD CONSTRAINT "ad_account_connection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

function secretMatches(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

async function run(providedSecret: string | null) {
  const secret = process.env.MIGRATION_APPLY_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Rota desativada — defina MIGRATION_APPLY_SECRET na Vercel pra habilitar." },
      { status: 503 },
    );
  }

  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Apenas Super Admin." }, { status: 403 });
  }
  if (!providedSecret || !secretMatches(providedSecret, secret)) {
    return NextResponse.json({ error: "Secret ausente ou inválido." }, { status: 403 });
  }

  const existing = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_account_connection') as "exists"`,
  );
  if (existing[0]?.exists) {
    return NextResponse.json({ ok: true, alreadyApplied: true });
  }

  const executed: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const statement of STATEMENTS) {
        await tx.$executeRawUnsafe(statement);
        executed.push(statement.split("\n")[0]!.slice(0, 70));
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ ok: false, error: message, executed }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    alreadyApplied: false,
    executed,
    next: "Rodar `npx prisma migrate resolve --applied 20260929120000_ad_account_connection` (dentro de packages/db) assim que houver acesso via CLI ao Neon — sincroniza o histórico do Prisma com o que já foi aplicado aqui.",
  });
}

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  return run(secret);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : null;
  return run(secret);
}
