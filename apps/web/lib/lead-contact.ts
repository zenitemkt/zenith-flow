import type { Prisma } from "@prisma/client";
import { normalizeEmail } from "./leads";
import { createInitialOpportunityForLead } from "./lead-pipeline";

export interface LeadSubmissionInput {
  agencyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  city?: string | null;
  interest?: string | null;
  service?: string | null;
  employees?: string | null;
  investment?: string | null;
  summary?: string | null;
  actorUserId?: string | null;
  createOpportunity?: "always" | "new-only";
}

export class LeadIdentityConflictError extends Error {
  constructor() {
    super("O e-mail e o telefone informados pertencem a contatos diferentes. Revise os cadastros antes de continuar.");
    this.name = "LeadIdentityConflictError";
  }
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export function splitContactName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().replace(/\s+/g, " ").split(" ");
  return { firstName: parts[0] ?? name.trim(), lastName: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

export function mostCompleteName(current: string, incoming: string): string {
  const cleanCurrent = current.trim().replace(/\s+/g, " ");
  const cleanIncoming = incoming.trim().replace(/\s+/g, " ");
  const score = (value: string): [number, number] => [
    value.split(" ").filter(Boolean).length,
    value.replace(/\s/g, "").length,
  ];
  const [currentWords, currentLength] = score(cleanCurrent);
  const [incomingWords, incomingLength] = score(cleanIncoming);
  return incomingWords > currentWords || (incomingWords === currentWords && incomingLength > currentLength)
    ? cleanIncoming
    : cleanCurrent;
}

export async function upsertLeadSubmission(tx: Prisma.TransactionClient, input: LeadSubmissionInput) {
  const email = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);

  const [emailIdentity, phoneIdentity] = await Promise.all([
    email
      ? tx.leadEmail.findUnique({ where: { agencyId_normalizedValue: { agencyId: input.agencyId, normalizedValue: email } } })
      : null,
    normalizedPhone
      ? tx.leadPhone.findUnique({ where: { agencyId_normalizedValue: { agencyId: input.agencyId, normalizedValue: normalizedPhone } } })
      : null,
  ]);

  if (emailIdentity && phoneIdentity && emailIdentity.leadId !== phoneIdentity.leadId) {
    throw new LeadIdentityConflictError();
  }

  const matchedLeadId = emailIdentity?.leadId ?? phoneIdentity?.leadId ?? null;
  let lead = matchedLeadId ? await tx.lead.findUnique({ where: { id: matchedLeadId } }) : null;
  const createdNewLead = !lead;

  if (!lead) {
    const parsed = splitContactName(input.name);
    lead = await tx.lead.create({
      data: {
        agencyId: input.agencyId,
        name: input.name.trim().replace(/\s+/g, " "),
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email,
        phone: input.phone?.trim() || null,
        company: input.company?.trim() || null,
        source: input.source?.trim() || null,
        createdByUserId: input.actorUserId ?? null,
      },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, toStatus: "NOVO", actorUserId: input.actorUserId ?? null },
    });
  } else {
    const previousStatus = lead.status;
    const restartCommercialCycle = input.createOpportunity !== "new-only" && previousStatus !== "NOVO";
    const richerName = mostCompleteName(lead.name, input.name);
    const parsed = splitContactName(richerName);
    lead = await tx.lead.update({
      where: { id: lead.id },
      data: {
        name: richerName,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: lead.email ?? email,
        phone: lead.phone ?? input.phone?.trim() ?? null,
        company: lead.company ?? input.company?.trim() ?? null,
        status: restartCommercialCycle ? "NOVO" : undefined,
        disqualifiedReason: restartCommercialCycle ? null : undefined,
      },
    });
    if (restartCommercialCycle) {
      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          fromStatus: previousStatus,
          toStatus: "NOVO",
          actorUserId: input.actorUserId ?? null,
          reason: "Novo interesse recebido",
        },
      });
    }
  }

  if (email) {
    await tx.leadEmail.upsert({
      where: { agencyId_normalizedValue: { agencyId: input.agencyId, normalizedValue: email } },
      create: { agencyId: input.agencyId, leadId: lead.id, value: input.email!.trim(), normalizedValue: email },
      update: { value: input.email!.trim(), lastSeenAt: new Date() },
    });
  }
  if (normalizedPhone) {
    await tx.leadPhone.upsert({
      where: { agencyId_normalizedValue: { agencyId: input.agencyId, normalizedValue: normalizedPhone } },
      create: { agencyId: input.agencyId, leadId: lead.id, value: input.phone!.trim(), normalizedValue: normalizedPhone },
      update: { value: input.phone!.trim(), lastSeenAt: new Date() },
    });
  }

  const submission = await tx.leadSubmission.create({
    data: {
      agencyId: input.agencyId,
      leadId: lead.id,
      source: input.source?.trim() || null,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      city: input.city?.trim() || null,
      interest: input.interest?.trim() || null,
      service: input.service?.trim() || null,
      employees: input.employees?.trim() || null,
      investment: input.investment?.trim() || null,
      summary: input.summary?.trim() || null,
    },
  });

  let opportunity = null;
  if (input.createOpportunity !== "new-only" || createdNewLead) {
    const detail = input.service?.trim() || input.interest?.trim();
    opportunity = await createInitialOpportunityForLead(tx, {
      agencyId: input.agencyId,
      leadId: lead.id,
      leadName: detail ? `${lead.name} — ${detail}` : lead.name,
      actorUserId: input.actorUserId ?? null,
      submissionId: submission.id,
    });
  }

  await tx.auditLog.create({
    data: {
      agencyId: input.agencyId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorUserId ? "user" : "integration",
      action: createdNewLead ? "lead.created" : "lead.submission.received",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: { submissionId: submission.id, opportunityId: opportunity?.id ?? null, matched: !createdNewLead },
    },
  });

  return { lead, submission, opportunity, createdNewLead };
}