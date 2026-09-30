import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";

/**
 * Escape-hatch temporário (mesmo padrão de 2026-09-29/2026-09-30, ver
 * docs/DECISIONS.md) — aplica a migration
 * `20260930150000_meta_pixel_and_event_delivery` direto em produção usando as
 * credenciais que a própria Vercel já tem configuradas, porque o acesso via
 * CLI ao Neon segue indisponível nesta sessão. SQL puramente aditivo (2
 * enums, 1 coluna nova nullable, 1 tabela nova).
 *
 * Depois de rodar com sucesso: `npx prisma migrate resolve --applied
 * 20260930150000_meta_pixel_and_event_delivery` (dentro de packages/db)
 * assim que houver acesso via CLI. Remover esta rota depois de usada.
 */

const STATEMENTS = [
  `CREATE TYPE "EventDeliveryDestination" AS ENUM ('META', 'GA4')`,
  `CREATE TYPE "EventDeliveryStatus" AS ENUM ('SENT', 'FAILED')`,
  `ALTER TABLE "ad_account_connection" ADD COLUMN "metaPixelId" TEXT`,
  `CREATE TABLE "event_delivery" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "trackingEventId" TEXT NOT NULL,
    "destination" "EventDeliveryDestination" NOT NULL,
    "status" "EventDeliveryStatus" NOT NULL,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_delivery_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX "event_delivery_agencyId_attemptedAt_idx" ON "event_delivery"("agencyId", "attemptedAt")`,
  `CREATE INDEX "event_delivery_trackingEventId_idx" ON "event_delivery"("trackingEventId")`,
  `ALTER TABLE "event_delivery" ADD CONSTRAINT "event_delivery_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "event_delivery" ADD CONSTRAINT "event_delivery_trackingEventId_fkey" FOREIGN KEY ("trackingEventId") REFERENCES "tracking_event"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
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
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_delivery') as "exists"`,
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
    next: "Rodar `npx prisma migrate resolve --applied 20260930150000_meta_pixel_and_event_delivery` (dentro de packages/db) assim que houver acesso via CLI ao Neon.",
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
