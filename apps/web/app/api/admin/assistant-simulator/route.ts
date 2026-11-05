import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { mergeAssistantConfig } from "@/lib/assistant/config";
import { simulateTurn, type SimMessage } from "@/lib/assistant/simulate";

export const maxDuration = 60;

/** Simulador: devolve o que a Milena responderia, sem enviar nada a ninguém. */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const messages: SimMessage[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: SimMessage) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .map((m: SimMessage) => ({ role: m.role, content: m.content.slice(0, 4000), image: m.image?.data && m.image.data.length < 6_000_000 ? m.image : undefined }))
    : [];
  if (!messages.length) return NextResponse.json({ error: "Mande pelo menos uma mensagem do lead." }, { status: 400 });
  try {
    const result = await simulateTurn(membership.agencyId, {
      messages,
      profileName: typeof body?.profileName === "string" ? body.profileName.slice(0, 120) : undefined,
      leadContext: typeof body?.leadContext === "string" ? body.leadContext.slice(0, 3000) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("assistant_simulator_failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao gerar a resposta." }, { status: 500 });
  }
}

/** Salva as instruções extras (ajustes feitos a partir dos testes). */
export async function PUT(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores podem alterar a assistente." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.extraInstructions !== "string") return NextResponse.json({ error: "Texto obrigatório." }, { status: 400 });
  const settings = await prisma.assistantSettings.findUnique({ where: { agencyId: membership.agencyId } });
  const config = mergeAssistantConfig(settings?.config);
  config.conversation.extraInstructions = body.extraInstructions.slice(0, 8000);
  const json = config as unknown as Prisma.InputJsonValue;
  await prisma.assistantSettings.upsert({
    where: { agencyId: membership.agencyId },
    create: { agencyId: membership.agencyId, enabled: false, config: json },
    update: { config: json },
  });
  return NextResponse.json({ ok: true });
}
