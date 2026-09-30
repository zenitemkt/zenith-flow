import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

/** Salva/atualiza o Pixel ID da Meta (seção 38.1, Etapa 2) — dado público, guardado junto da conexão Meta já existente. */
export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const pixelId = typeof body?.pixelId === "string" ? body.pixelId.trim() : "";
  if (!pixelId || !/^\d+$/.test(pixelId)) {
    return NextResponse.json({ error: "Pixel ID inválido — deve conter só números." }, { status: 400 });
  }

  const connection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } },
  });
  if (!connection) {
    return NextResponse.json({ error: "Conecte a conta da Meta antes de configurar o Pixel." }, { status: 400 });
  }

  await prisma.adAccountConnection.update({
    where: { id: connection.id },
    data: { metaPixelId: pixelId },
  });

  return NextResponse.json({ ok: true });
}
