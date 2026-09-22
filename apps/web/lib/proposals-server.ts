import { randomUUID } from "node:crypto";
import type { Prisma, Proposal } from "@zenite-mkt/db";
import { PROPOSAL_TTL_MS } from "./proposals";

/** Server-only — nunca importar a partir de um client component (ver lib/media-server.ts para o mesmo padrão). */
export function generateProposalToken(): string {
  return randomUUID();
}

type TxClient = Prisma.TransactionClient;

/**
 * Garante a transição RASCUNHO -> ENVIADA exatamente uma vez, chamada tanto
 * pelo envio por e-mail quanto pelo WhatsApp — quem chega primeiro dispara a
 * transição, o segundo é no-op (permite mandar pelos 2 canais em sequência
 * sem um bloquear o outro).
 */
export async function ensureProposalSent(tx: TxClient, proposal: Proposal, actorUserId: string): Promise<void> {
  if (proposal.status !== "RASCUNHO") return;

  const now = new Date();
  await tx.proposal.update({
    where: { id: proposal.id },
    data: { status: "ENVIADA", sentAt: now, expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS) },
  });
  await tx.proposalStatusHistory.create({
    data: { proposalId: proposal.id, fromStatus: "RASCUNHO", toStatus: "ENVIADA", actorUserId },
  });
  await tx.auditLog.create({
    data: {
      agencyId: proposal.agencyId,
      actorUserId,
      actorType: "user",
      action: "proposal.sent",
      resourceType: "proposal",
      resourceId: proposal.id,
    },
  });
}

export function buildWhatsappMessage(publicUrl: string): string {
  return `Oi! Segue nossa proposta! ${publicUrl}\n\nEstou à disposição para eventuais esclarecimentos!`;
}

/** Contexto é todo pt-BR/BRL — assume DDI 55 quando o número vem sem código de país. */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
