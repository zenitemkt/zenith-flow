import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { sendDueProspectEmails } from "@/lib/prospecting/outreach";

export const maxDuration = 60;

/** "Enviar e-mails de hoje": primeiro e-mail + lembrete de 3 dias, até o limite diário. */
export async function POST() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  try {
    return NextResponse.json(await sendDueProspectEmails(membership.agencyId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível enviar." }, { status: 400 });
  }
}
