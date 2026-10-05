import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { decryptSecret } from "@/lib/crypto-secrets";
import { sendMetaCapiEvent, MetaCapiError } from "@/lib/meta-capi";

/**
 * "Mandar evento de teste" (seção 6, Diagnóstico — Etapa 4) — dispara um
 * `PageView` sintético direto pra Conversions API, fora do fluxo normal do
 * coletor (não cria `TrackingEvent` nem `EventDelivery`, é só uma verificação
 * manual pontual). `client_user_agent` fixo evita o mesmo "Invalid parameter"
 * já corrigido na Etapa 2 (user_data nunca pode ir vazio).
 */
export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const connection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } },
  });
  if (!connection || !connection.metaPixelId) {
    return NextResponse.json({ error: "Conecte a Meta e configure o Pixel ID antes de testar." }, { status: 400 });
  }

  try {
    const accessToken = decryptSecret(connection.accessTokenEnc);
    await sendMetaCapiEvent(connection.metaPixelId, accessToken, {
      eventName: "PageView",
      eventId: `test_${Date.now()}`,
      occurredAt: new Date(),
      url: "https://hubzenite.com.br/",
      clientUserAgent: "ZenithFlowDiagnostico/1.0",
    });
    return NextResponse.json({ ok: true, message: "Evento de teste enviado — confira no Gerenciador de Eventos da Meta." });
  } catch (error) {
    const message = error instanceof MetaCapiError ? error.message : error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
