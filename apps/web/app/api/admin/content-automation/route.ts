import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { encryptSecret } from "@/lib/crypto-secrets";

/** Status da conexão — nunca devolve o token nem a chave de agente, só se está configurado. */
export async function GET() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const connection = await prisma.contentAutomationConnection.findUnique({ where: { agencyId: membership.agencyId } });
  if (!connection) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    githubOwner: connection.githubOwner,
    githubRepo: connection.githubRepo,
    githubBranch: connection.githubBranch,
    updatedAt: connection.updatedAt,
  });
}

/**
 * Configura/atualiza o repositório de destino e o token do GitHub. Gera uma
 * chave de agente nova (devolvida só nesta resposta, nunca mais — mesmo
 * espírito do refresh_token do GBP no blueprint, "mostrado uma única vez").
 */
export async function PUT(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem configurar esta integração." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const githubOwner = typeof body?.githubOwner === "string" ? body.githubOwner.trim() : "";
  const githubRepo = typeof body?.githubRepo === "string" ? body.githubRepo.trim() : "";
  const githubBranch = typeof body?.githubBranch === "string" && body.githubBranch.trim() ? body.githubBranch.trim() : "main";
  const githubToken = typeof body?.githubToken === "string" ? body.githubToken.trim() : "";
  if (!githubOwner || !githubRepo || !githubToken) {
    return NextResponse.json({ error: "Preencha owner, repositório e token do GitHub." }, { status: 400 });
  }

  const agentApiKey = `blog_${randomBytes(24).toString("hex")}`;
  await prisma.contentAutomationConnection.upsert({
    where: { agencyId: membership.agencyId },
    create: {
      agencyId: membership.agencyId,
      githubOwner,
      githubRepo,
      githubBranch,
      githubTokenEnc: encryptSecret(githubToken),
      agentApiKeyEnc: encryptSecret(agentApiKey),
    },
    update: {
      githubOwner,
      githubRepo,
      githubBranch,
      githubTokenEnc: encryptSecret(githubToken),
      agentApiKeyEnc: encryptSecret(agentApiKey),
    },
  });

  return NextResponse.json({ ok: true, agentApiKey });
}
