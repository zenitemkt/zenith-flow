import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { encryptSecret } from "@/lib/crypto-secrets";

/** Gera uma chave de agente nova e substitui a anterior — mostrada uma única vez na resposta, nunca mais. */
export async function POST() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerar a chave de agente." }, { status: 403 });
  }

  const existing = await prisma.contentAutomationConnection.findUnique({ where: { agencyId: membership.agencyId } });
  if (!existing) return NextResponse.json({ error: "Configure a conexão com o GitHub antes." }, { status: 400 });

  const agentApiKey = `blog_${randomBytes(24).toString("hex")}`;
  await prisma.contentAutomationConnection.update({
    where: { agencyId: membership.agencyId },
    data: { agentApiKeyEnc: encryptSecret(agentApiKey) },
  });
  return NextResponse.json({ ok: true, agentApiKey });
}
