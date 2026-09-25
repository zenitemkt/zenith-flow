import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { reaisToCents } from "@/lib/finance";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

function nonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/**
 * Registra (ou corrige) a métrica reportada de um dia — sem conector real
 * ainda (seção 38), tudo digitado à mão. `@@unique([campaignId, date])`
 * garante que reenviar o mesmo dia corrige em vez de duplicar (upsert).
 */
export async function POST(request: Request, { params }: RouteParams) {
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

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const dateRaw = typeof body?.date === "string" ? body.date : "";
  const date = dateRaw ? new Date(`${dateRaw}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Informe uma data válida." }, { status: 400 });
  }

  const spendCents = body?.spend === null || body?.spend === undefined || body?.spend === "" ? 0 : reaisToCents(Number(body.spend));
  const impressions = nonNegativeInt(body?.impressions);
  const clicks = nonNegativeInt(body?.clicks);
  const reach = body?.reach === null || body?.reach === undefined || body?.reach === "" ? null : nonNegativeInt(body.reach);
  const results = body?.results === null || body?.results === undefined || body?.results === "" ? null : nonNegativeInt(body.results);
  const resultValueCents =
    body?.resultValue === null || body?.resultValue === undefined || body?.resultValue === ""
      ? null
      : reaisToCents(Number(body.resultValue));

  if (
    !Number.isFinite(spendCents) ||
    spendCents < 0 ||
    impressions === null ||
    clicks === null ||
    (resultValueCents !== null && !Number.isFinite(resultValueCents))
  ) {
    return NextResponse.json({ error: "Valores inválidos." }, { status: 400 });
  }

  await prisma.campaignDailyMetric.upsert({
    where: { campaignId_date: { campaignId: campaign.id, date } },
    create: { campaignId: campaign.id, date, spendCents, impressions, clicks, reach, results, resultValueCents },
    update: { spendCents, impressions, clicks, reach, results, resultValueCents },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
