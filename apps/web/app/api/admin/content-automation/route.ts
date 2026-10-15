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
 * Configura/atualiza owner/repo/branch e (opcionalmente) o token do GitHub.
 * Deixar o campo de token em branco numa atualização mantém o token já
 * guardado — só precisa repetir o token quando for trocar de verdade (ex.:
 * PAT vencido). Não mexe na chave de agente (ver /regenerate-agent-key, que
 * tem o único botão que troca essa chave — gerar uma nova sem querer
 * invalidaria uma rotina já configurada com a anterior).
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
  if (!githubOwner || !githubRepo) {
    return NextResponse.json({ error: "Preencha owner e repositório do GitHub." }, { status: 400 });
  }

  const existing = await prisma.contentAutomationConnection.findUnique({ where: { agencyId: membership.agencyId } });
  if (!existing && !githubToken) {
    return NextResponse.json({ error: "Primeira configuração precisa do token do GitHub." }, { status: 400 });
  }

  if (!existing) {
    const agentApiKey = `blog_${randomBytes(24).toString("hex")}`;
    await prisma.contentAutomationConnection.create({
      data: { agencyId: membership.agencyId, githubOwner, githubRepo, githubBranch, githubTokenEnc: encryptSecret(githubToken), agentApiKeyEnc: encryptSecret(agentApiKey) },
    });
    return NextResponse.json({ ok: true, agentApiKey });
  }

  await prisma.contentAutomationConnection.update({
    where: { agencyId: membership.agencyId },
    data: { githubOwner, githubRepo, githubBranch, ...(githubToken ? { githubTokenEnc: encryptSecret(githubToken) } : {}) },
  });
  return NextResponse.json({ ok: true });
}
