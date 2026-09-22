/**
 * Cria UMA proposta de exemplo (status ENVIADA, com forma de pagamento e
 * etapas preenchidas) pra visualizar o novo layout público em /proposta/[token].
 * Script único, não faz parte do seed padrão — não roda em toda conta nova.
 *
 * Uso: npx tsx packages/db/scripts/seed-sample-proposal.ts
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../src/client";

async function main() {
  const agency = await prisma.agency.findFirst({ orderBy: { createdAt: "asc" } });
  if (!agency) {
    throw new Error("Nenhuma agência encontrada — crie uma conta pelo /signup antes de rodar este script.");
  }

  const client = await prisma.client.findFirst({ where: { agencyId: agency.id }, orderBy: { createdAt: "asc" } });
  const membership = await prisma.membership.findFirst({ where: { agencyId: agency.id }, orderBy: { createdAt: "asc" } });

  const now = new Date();
  const proposal = await prisma.proposal.create({
    data: {
      agencyId: agency.id,
      name: "[Exemplo] Consultoria de Marketing Digital",
      content:
        "Serviço de consultoria estratégica de marketing digital, com direcionamentos para a empresa e esclarecimento de dúvidas.\n\nElaboração de 3 modelos de documentos (Contrato de Trabalho, Contrato de Fornecedores e Procuração).",
      valueCents: 500000,
      paymentTerms: "50% na assinatura do contrato, 50% na entrega final",
      timelineSteps: [
        { label: "Proposta", days: 0 },
        { label: "Assinatura do contrato", days: 2 },
        { label: "Reunião esclarecer dúvidas", days: 30 },
        { label: "Primeira entrega dos documentos", days: 15 },
        { label: "Projeto finalizado", days: 15 },
      ],
      clientId: client?.id ?? null,
      status: "ENVIADA",
      token: randomUUID(),
      sentAt: now,
      expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      createdByUserId: membership?.userId ?? null,
    },
  });

  await prisma.proposalStatusHistory.createMany({
    data: [
      { proposalId: proposal.id, toStatus: "RASCUNHO", createdAt: now },
      { proposalId: proposal.id, fromStatus: "RASCUNHO", toStatus: "ENVIADA", createdAt: now },
    ],
  });

  console.log("Proposta de exemplo criada.");
  console.log(`Token: ${proposal.token}`);
  console.log(`Link público: /proposta/${proposal.token}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
