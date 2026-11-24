import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import type { SystemAlertCategory } from "@prisma/client";
import { requireSessionAndMembership } from "@/lib/session";

const CATEGORIES: SystemAlertCategory[] = ["SITE", "TRACKING", "BLOG", "SOCIAL", "AUTOMATION", "INTEGRATION"];

/**
 * Limpa (marca como resolvidos) os alertas abertos da própria agência — todos, só os `ids`
 * informados, ou só as `categories` informadas. Se o problema continuar, a próxima checagem
 * reabre o alerta como ocorrência nova (mesma regra do "Resolver" individual).
 */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { ids?: unknown; categories?: unknown } | null;

  const ids = Array.isArray(body?.ids) ? body!.ids.filter((v): v is string => typeof v === "string").slice(0, 500) : undefined;
  const categories = Array.isArray(body?.categories)
    ? body!.categories.filter((v): v is SystemAlertCategory => CATEGORIES.includes(v as SystemAlertCategory))
    : undefined;
  if ((ids && !ids.length) || (categories && !categories.length)) return NextResponse.json({ ok: true, cleared: 0 });

  const result = await prisma.systemAlert.updateMany({
    where: {
      agencyId: membership.agencyId,
      status: "OPEN",
      ...(ids ? { id: { in: ids } } : {}),
      ...(categories ? { category: { in: categories } } : {}),
    },
    data: { status: "RESOLVED", resolvedAt: new Date(), autoResolved: false },
  });
  return NextResponse.json({ ok: true, cleared: result.count });
}
