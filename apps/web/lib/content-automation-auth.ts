import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "./session";
import { decryptSecret } from "./crypto-secrets";

export interface ContentAutomationActor {
  agencyId: string;
  actor: "admin" | "agent";
}

function safeEqualStrings(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/**
 * Autenticação dupla (Blueprint de Automações, seção 1.2): cookie de sessão
 * (humano, pela tela de aprovação) OU chave fixa no header `x-draft-agent-key`
 * (a rotina agendada que escreve o conteúdo) — nunca uma coisa só, e cada
 * agência tem sua própria chave (nunca uma chave global).
 */
export async function resolveContentAutomationActor(request: Request): Promise<ContentAutomationActor | null> {
  const agentKey = request.headers.get("x-draft-agent-key");
  if (agentKey) {
    const connections = await prisma.contentAutomationConnection.findMany({ select: { agencyId: true, agentApiKeyEnc: true } });
    for (const connection of connections) {
      let decrypted: string;
      try {
        decrypted = decryptSecret(connection.agentApiKeyEnc);
      } catch {
        continue;
      }
      if (safeEqualStrings(decrypted, agentKey)) return { agencyId: connection.agencyId, actor: "agent" };
    }
    return null;
  }
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return null;
  return { agencyId: membership.agencyId, actor: "admin" };
}
