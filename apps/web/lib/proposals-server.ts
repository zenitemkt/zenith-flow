import { randomUUID } from "node:crypto";
import type { Prisma, Proposal } from "@zenite-mkt/db";
import { PROPOSAL_TTL_MS } from "./proposals";

/** Server-only — nunca importar a partir de um client component (ver lib/media-server.ts para o mesmo padrão). */
export function generateProposalToken(): string {
  return randomUUID();
}

type TxClient = Prisma.TransactionClient;

/**
 * Garante a transição pra ENVIADA exatamente uma vez por chamada, disparada
 * tanto pelo envio por e-mail quanto pelo WhatsApp — quem chega primeiro
 * dispara a transição, o segundo é no-op (permite mandar pelos 2 canais em
 * sequência sem um bloquear o outro). A partir de RASCUNHO é o primeiro
 * envio; a partir de REJEITADA/EXPIRADA é um reenvio depois de renegociar
 * (pedido do usuário, 2026-09-27) — o motivo da recusa anterior não se perde
 * ao zerar `rejectedReason`, porque já ficou gravado pra sempre em
 * `ProposalStatusHistory.reason` na transição ENVIADA -> REJEITADA.
 */
export async function ensureProposalSent(tx: TxClient, proposal: Proposal, actorUserId: string): Promise<void> {
  const isResend = proposal.status === "REJEITADA" || proposal.status === "EXPIRADA";
  if (proposal.status !== "RASCUNHO" && !isResend) return;

  const now = new Date();
  await tx.proposal.update({
    where: { id: proposal.id },
    data: {
      status: "ENVIADA",
      sentAt: now,
      expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS),
      rejectedReason: null,
      viewedAt: null,
      respondedAt: null,
    },
  });
  await tx.proposalStatusHistory.create({
    data: { proposalId: proposal.id, fromStatus: proposal.status, toStatus: "ENVIADA", actorUserId },
  });
  await tx.auditLog.create({
    data: {
      agencyId: proposal.agencyId,
      actorUserId,
      actorType: "user",
      action: isResend ? "proposal.resent" : "proposal.sent",
      resourceType: "proposal",
      resourceId: proposal.id,
    },
  });
}

export function buildProposalWhatsappMessage(publicUrl: string): string {
  return `Oi! Segue nossa proposta! ${publicUrl}\n\nEstou à disposição para eventuais esclarecimentos!`;
}
