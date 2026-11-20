import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { markWhatsappFollowUpSent, markWhatsappSent } from "@/lib/prospecting/outreach";

/** "Já enviei" (primeiro contato ou follow-up) pelo celular do número da Milena. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  try {
    if (body?.step === "followup") await markWhatsappFollowUpSent(membership.agencyId, params.id);
    else await markWhatsappSent(membership.agencyId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível registrar." }, { status: 400 });
  }
}
