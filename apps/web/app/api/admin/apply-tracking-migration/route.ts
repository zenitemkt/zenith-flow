import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";

/**
 * Escape-hatch temporário (mesmo padrão de 2026-09-29, ver docs/DECISIONS.md)
 * — aplica a migration `20260930120000_tracking_session_geo_device` direto em
 * produção usando as credenciais que a própria Vercel já tem configuradas,
 * porque o acesso via CLI ao Neon segue indisponível nesta sessão. SQL
 * puramente aditivo (5 colunas novas, nullable, em tabela já existente).
 *
 * Depois de rodar com sucesso: `npx prisma migrate resolve --applied
 * 20260930120000_tracking_session_geo_device` (dentro de packages/db) assim
 * que houver acesso via CLI. Remover esta rota depois de usada.
 */

const STATEMENTS = [
  `ALTER TABLE "tracking_session" ADD COLUMN "browser" TEXT, ADD COLUMN "city" TEXT, ADD COLUMN "country" TEXT, ADD COLUMN "deviceType" TEXT, ADD COLUMN "region" TEXT`,
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
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tracking_session' AND column_name = 'city') as "exists"`,
  );
  if (existing[0]?.exists) {
    return NextResponse.json({ ok: true, alreadyApplied: true });
  }

  const executed: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const statement of STATEMENTS) {
        await tx.$executeRawUnsafe(statement);
        executed.push(statement.slice(0, 70));
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
    next: "Rodar `npx prisma migrate resolve --applied 20260930120000_tracking_session_geo_device` (dentro de packages/db) assim que houver acesso via CLI ao Neon.",
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
