import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { markWhatsappSent } from "@/lib/prospecting/outreach";

/** "Já enviei" o primeiro WhatsApp pelo celular: a Milena assume quando a empresa responder. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  try {
    await markWhatsappSent(membership.agencyId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível registrar." }, { status: 400 });
  }
}
