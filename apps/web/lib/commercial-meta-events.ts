import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { sendMetaCapiEvent } from "@/lib/meta-capi";

export type CommercialMetaEventName = "Lead" | "QualifiedLead" | "ProposalSent" | "Purchase";

interface DispatchCommercialMetaEventInput {
  agencyId: string;
  eventName: CommercialMetaEventName;
  eventKey: string;
  resourceType: "lead" | "opportunity" | "proposal" | "finance_entry";
  resourceId: string;
  leadId?: string | null;
  clientId?: string | null;
  valueCents?: number | null;
  occurredAt?: Date;
}

function stringFromJson(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

/** Envia uma mudança real do CRM para a Meta uma única vez. Falhas ficam registradas e nunca interrompem a operação comercial. */
export async function dispatchCommercialMetaEvent(input: DispatchCommercialMetaEventInput): Promise<void> {
  const existing = await prisma.commercialMetaEvent.findUnique({ where: { agencyId_eventKey: { agencyId: input.agencyId, eventKey: input.eventKey } } });
  if (existing?.status === "SENT") return;

  const connection = await prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId: input.agencyId, platform: "META" } } });
  if (!connection || connection.status !== "ACTIVE" || !connection.metaPixelId) return;

  const [lead, client] = await Promise.all([
    input.leadId ? prisma.lead.findFirst({ where: { id: input.leadId, agencyId: input.agencyId }, select: { email: true, phone: true, submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { trackingContext: true } } } }) : null,
    input.clientId ? prisma.client.findFirst({ where: { id: input.clientId, agencyId: input.agencyId }, select: { email: true, phone: true } }) : null,
  ]);
  const tracking = lead?.submissions[0]?.trackingContext;
  let status: "SENT" | "FAILED" = "SENT";
  let error: string | null = null;
  try {
    await sendMetaCapiEvent(connection.metaPixelId, decryptSecret(connection.accessTokenEnc), {
      eventName: input.eventName,
      eventId: input.eventKey,
      occurredAt: input.occurredAt ?? new Date(),
      url: stringFromJson(tracking, "url"),
      email: lead?.email ?? client?.email,
      phone: lead?.phone ?? client?.phone,
      fbp: stringFromJson(tracking, "fbp"),
      fbc: stringFromJson(tracking, "fbc"),
      actionSource: "system_generated",
      customData: input.valueCents != null ? { value: input.valueCents / 100, currency: "BRL" } : undefined,
      testEventCode: process.env.META_CAPI_TEST_EVENT_CODE || null,
    });
  } catch (cause) {
    status = "FAILED";
    error = cause instanceof Error ? cause.message : "Erro desconhecido.";
  }

  await prisma.commercialMetaEvent.upsert({
    where: { agencyId_eventKey: { agencyId: input.agencyId, eventKey: input.eventKey } },
    update: { status, error, attemptedAt: new Date(), valueCents: input.valueCents ?? null },
    create: { agencyId: input.agencyId, eventKey: input.eventKey, eventName: input.eventName, resourceType: input.resourceType, resourceId: input.resourceId, leadId: input.leadId ?? null, clientId: input.clientId ?? null, valueCents: input.valueCents ?? null, status, error },
  }).catch(() => undefined);
}
