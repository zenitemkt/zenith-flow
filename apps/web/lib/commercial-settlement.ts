import type { FinanceEntry, Prisma } from "@zenite-mkt/db";

/**
 * Receiving a commercial receivable closes the loop atomically: the Lead
 * becomes a Client and the linked Opportunity becomes WON. A payable or an
 * unrelated manual receipt does not affect the CRM.
 */
export async function settleCommercialReceivable(
  tx: Prisma.TransactionClient,
  entry: FinanceEntry,
  actorUserId: string,
) {
  if (entry.type !== "RECEITA" || !entry.opportunityId) return null;

  const opportunity = await tx.opportunity.findUnique({
    where: { id: entry.opportunityId },
    include: { lead: true },
  });
  if (!opportunity || opportunity.agencyId !== entry.agencyId) return null;

  const proposal = entry.proposalId
    ? await tx.proposal.findUnique({ where: { id: entry.proposalId } })
    : null;
  const lead = opportunity.lead;
  let clientId = opportunity.clientId ?? proposal?.clientId ?? lead?.convertedClientId ?? null;

  if (!clientId && lead) {
    const client = await tx.client.create({
      data: {
        agencyId: entry.agencyId,
        name: lead.company || lead.name,
        email: lead.email,
        phone: lead.phone,
      },
    });
    clientId = client.id;
    await tx.clientStatusHistory.create({
      data: { clientId, toStatus: "PROSPECT", actorUserId },
    });
    if (lead.email || lead.phone || lead.name) {
      await tx.clientContact.create({
        data: { clientId, name: lead.name, email: lead.email, phone: lead.phone, isPrimary: true },
      });
    }
  }

  if (lead && clientId && lead.status !== "CONVERTIDO") {
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTIDO", convertedClientId: clientId },
    });
    await tx.leadStatusHistory.create({
      data: {
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: "CONVERTIDO",
        reason: "Pagamento recebido",
        actorUserId,
      },
    });
  }

  let wonOpportunity = opportunity;
  if (opportunity.status === "OPEN") {
    wonOpportunity = await tx.opportunity.update({
      where: { id: opportunity.id },
      data: {
        status: "WON",
        clientId,
        valueCents: proposal?.valueCents ?? opportunity.valueCents ?? entry.amountCents,
        lostReason: null,
      },
      include: { lead: true },
    });
    await tx.opportunityStatusHistory.create({
      data: {
        opportunityId: opportunity.id,
        toStatus: "WON",
        reason: "Pagamento recebido",
        actorUserId,
      },
    });
  }

  if (clientId) {
    await tx.financeEntry.update({ where: { id: entry.id }, data: { clientId } });
    if (proposal && !proposal.clientId) {
      await tx.proposal.update({ where: { id: proposal.id }, data: { clientId } });
    }
  }

  await tx.auditLog.create({
    data: {
      agencyId: entry.agencyId,
      actorUserId,
      actorType: "user",
      action: "commercial.payment_received",
      resourceType: "opportunity",
      resourceId: opportunity.id,
      metadata: { financeEntryId: entry.id, proposalId: entry.proposalId, leadId: lead?.id ?? null, clientId },
    },
  });

  return wonOpportunity;
}
