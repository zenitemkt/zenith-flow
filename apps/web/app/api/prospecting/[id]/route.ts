import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { convertProspectToLead } from "@/lib/prospecting/search";

/** Ação manual num prospect: virar lead, descartar ou voltar pra lista. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === "lead") {
    try {
      const leadId = await convertProspectToLead(membership.agencyId, params.id, session.user.id);
      return NextResponse.json({ ok: true, leadId });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível criar o lead." }, { status: 400 });
    }
  }
  if (action !== "discard" && action !== "restore") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

  const result = await prisma.prospect.updateMany({
    where: { id: params.id, agencyId: membership.agencyId, status: { not: "VIROU_LEAD" } },
    data: { status: action === "discard" ? "DESQUALIFICADO" : "NOVO" },
  });
  if (result.count === 0) return NextResponse.json({ error: "Prospect não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
