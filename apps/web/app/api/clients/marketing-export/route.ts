import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { parseMarketingFilters, fetchMarketingRows, buildMarketingCsv } from "@/lib/marketing-audience";

/** Mesmos filtros da tela `/clientes/marketing`, servidos como download em vez de HTML. */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const hasAnyParam = [...searchParams.keys()].length > 0;
  const filters = parseMarketingFilters((key) => searchParams.getAll(key), hasAnyParam);

  const rows = await fetchMarketingRows(membership.agencyId, filters);
  const csv = buildMarketingCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relacionamento-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
