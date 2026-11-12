import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { MetaSyncError, syncMetaCampaigns } from "@/lib/meta-campaign-sync";

export const maxDuration = 60;

/**
 * "Atualizar da Meta" (botão e atualização automática ao abrir Campanhas e
 * Raio-X): nome, situação real e métricas dos últimos 30 dias das campanhas
 * da conta conectada. Regras em `lib/meta-campaign-sync.ts`. Campanhas de
 * outros canais (ex.: Google Ads) continuam só manuais.
 */
export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  try {
    const result = await syncMetaCampaigns(membership.agencyId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MetaSyncError) {
      const notConnected = error.message.startsWith("Conecte");
      return NextResponse.json({ error: error.message }, { status: notConnected ? 400 : 502 });
    }
    throw error;
  }
}
