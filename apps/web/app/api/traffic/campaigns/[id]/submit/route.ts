import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { submitTrafficCampaign } from "@/lib/traffic-campaigns";
import { withAgencyDrive } from "@/lib/drive-auth";

export const maxDuration = 60;

/** "Aprovar e subir": envia (ou continua enviando) a campanha para a Meta, tudo pausado. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores sobem campanhas." }, { status: 403 });
  return NextResponse.json(await withAgencyDrive(membership.agencyId, () => submitTrafficCampaign(params.id, membership.agencyId, 45_000)));
}
