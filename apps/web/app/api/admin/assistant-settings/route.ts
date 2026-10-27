import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { mergeAssistantConfig } from "@/lib/assistant/config";

/** Configurações da assistente virtual (painel /automacoes/assistente). */
export async function PUT(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores podem alterar a assistente." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const config = mergeAssistantConfig(body?.config) as unknown as Prisma.InputJsonValue;
  const enabled = body?.enabled === true;
  await prisma.assistantSettings.upsert({
    where: { agencyId: membership.agencyId },
    create: { agencyId: membership.agencyId, enabled, config },
    update: { enabled, config },
  });
  return NextResponse.json({ ok: true });
}

/** Devolve uma conversa para a assistente depois do atendimento humano. */
export async function PATCH(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.conversationId !== "string") return NextResponse.json({ error: "conversationId obrigatório." }, { status: 400 });
  const updated = await prisma.assistantConversation.updateMany({ where: { id: body.conversationId, agencyId: membership.agencyId }, data: { mode: "bot" } });
  return NextResponse.json({ ok: updated.count > 0 });
}
