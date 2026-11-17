import { Prisma, prisma } from "@zenite-mkt/db";
import { waPhone } from "./form-outreach";
import type { WhatsappActivity } from "./follow-up";

interface LeadPhones {
  id: string;
  phone: string | null;
  phones?: { value: string }[];
}

/**
 * Última mensagem real da conversa de WhatsApp de cada lead (ligada pelo `leadId` ou pelo
 * celular). Mensagens internas "[sistema] ..." não contam como fala do lead.
 */
export async function getLeadWhatsappActivity(agencyId: string, leads: LeadPhones[]): Promise<Map<string, WhatsappActivity>> {
  const result = new Map<string, WhatsappActivity>();
  if (leads.length === 0) return result;

  const leadByPhone = new Map<string, string>();
  for (const lead of leads) {
    for (const raw of [lead.phone, ...(lead.phones ?? []).map((p) => p.value)]) {
      const phone = waPhone(raw);
      if (phone && !leadByPhone.has(phone)) leadByPhone.set(phone, lead.id);
    }
  }
  const leadIds = leads.map((lead) => lead.id);
  const conversations = await prisma.assistantConversation.findMany({
    where: { agencyId, OR: [{ leadId: { in: leadIds } }, { phone: { in: [...leadByPhone.keys()] } }] },
    select: { id: true, leadId: true, phone: true },
  });
  if (conversations.length === 0) return result;

  const lastMessages = await prisma.$queryRaw<{ conversationId: string; role: string; createdAt: Date }[]>(Prisma.sql`
    SELECT DISTINCT ON ("conversationId") "conversationId", "role", "createdAt"
    FROM "assistant_message"
    WHERE "conversationId" = ANY(${conversations.map((c) => c.id)}::text[])
      AND "content" NOT LIKE '[sistema]%'
    ORDER BY "conversationId", "createdAt" DESC
  `);
  const lastByConversation = new Map(lastMessages.map((m) => [m.conversationId, m]));

  const known = new Set(leadIds);
  for (const conv of conversations) {
    const last = lastByConversation.get(conv.id);
    if (!last) continue;
    const leadId = conv.leadId && known.has(conv.leadId) ? conv.leadId : leadByPhone.get(conv.phone);
    if (!leadId) continue;
    const current = result.get(leadId);
    if (!current || last.createdAt > current.lastMessageAt) {
      result.set(leadId, { conversationId: conv.id, lastMessageAt: last.createdAt, lastMessageRole: last.role });
    }
  }
  return result;
}
