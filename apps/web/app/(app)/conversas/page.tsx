import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { InboxView, type InboxFollowUp, type InboxItem, type InboxMessage } from "./InboxView";
import { followUpState, suggestFollowUp, timeAgo } from "@/lib/assistant/follow-up";

export const dynamic = "force-dynamic";

export default async function ConversasPage({ searchParams }: { searchParams: { c?: string; canal?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  if (isClientRole(membership.role)) redirect("/");
  const agencyId = membership.agencyId;

  const [waConvs, igThreads] = await Promise.all([
    prisma.assistantConversation.findMany({
      where: { agencyId },
      orderBy: { updatedAt: "desc" },
      take: 150,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.socialInboxThread.findMany({
      where: { agencyId },
      orderBy: { lastMessageAt: "desc" },
      take: 150,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  // Nome do lead do CRM (pelo vínculo da conversa ou pelo telefone) tem prioridade sobre o perfil do WhatsApp.
  const crmLeads = waConvs.length
    ? await prisma.lead.findMany({
        where: { agencyId, OR: [{ id: { in: waConvs.map((c) => c.leadId).filter((x): x is string => Boolean(x)) } }, { phone: { in: waConvs.map((c) => `+${c.phone}`) } }] },
        select: { id: true, name: true, phone: true, status: true },
      })
    : [];
  const leadNameById = new Map(crmLeads.map((l) => [l.id, l.name]));
  const leadNameByPhone = new Map(crmLeads.filter((l) => l.phone).map((l) => [l.phone!.replace(/\D/g, ""), l.name]));
  const leadById = new Map(crmLeads.map((l) => [l.id, l]));
  const leadByPhone = new Map(crmLeads.filter((l) => l.phone).map((l) => [l.phone!.replace(/\D/g, ""), l]));
  const leadOf = (c: { leadId: string | null; phone: string }) => (c.leadId && leadById.get(c.leadId)) || leadByPhone.get(c.phone) || null;
  const now = new Date();
  // Última mensagem real (as "[sistema] ..." são instruções internas, não fala do contato).
  const waState = (c: { id: string; leadId: string | null; phone: string }, last: { role: string; content: string; createdAt: Date } | undefined) =>
    followUpState(last && !last.content.startsWith("[sistema]") ? { conversationId: c.id, lastMessageAt: last.createdAt, lastMessageRole: last.role } : null, leadOf(c)?.status ?? "EM_ANDAMENTO", now);
  const clientIds = Array.from(new Set(igThreads.map((t) => t.clientId).filter((x): x is string => Boolean(x))));
  const clients = clientIds.length ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const items: InboxItem[] = [
    ...waConvs.map((c) => ({
      key: `wa:${c.id}`,
      channel: "WHATSAPP" as const,
      name: (c.leadId && leadNameById.get(c.leadId)) || leadNameByPhone.get(c.phone) || c.profileName || `+${c.phone}`,
      sub: `+${c.phone}`,
      preview: c.messages[0]?.content ?? "",
      lastAt: (c.messages[0]?.createdAt ?? c.updatedAt).toISOString(),
      mode: c.mode as "bot" | "human",
      classification: c.classification,
      account: "Milena",
      needsFollowUp: waState(c, c.messages[0]).needsFollowUp,
    })),
    ...igThreads.map((t) => ({
      key: `ig:${t.id}`,
      channel: t.channel === "MESSENGER" ? ("MESSENGER" as const) : ("INSTAGRAM" as const),
      name: t.participantName || (t.participantUsername ? `@${t.participantUsername}` : t.channel === "MESSENGER" ? "Contato do Messenger" : "Contato do Instagram"),
      sub: t.participantUsername ? `@${t.participantUsername}` : "",
      preview: t.messages[0]?.text ?? "",
      lastAt: t.lastMessageAt.toISOString(),
      mode: null,
      classification: null,
      account: (t.clientId && clientName.get(t.clientId)) || (t.channel === "MESSENGER" ? "Facebook" : "Instagram"),
      needsFollowUp: false,
    })),
  ].sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const selected = searchParams.c ?? null;
  let messages: InboxMessage[] = [];
  let followUp: InboxFollowUp | null = null;
  const [kind, id] = (selected ?? "").split(":");
  if (kind === "wa" && id) {
    const rows = await prisma.assistantMessage.findMany({ where: { conversationId: id, conversation: { agencyId } }, orderBy: { createdAt: "desc" }, take: 300 });
    const conv = waConvs.find((c) => c.id === id);
    const lastReal = rows.find((m) => !m.content.startsWith("[sistema]"));
    const state = conv ? waState(conv, lastReal) : null;
    // Retomada: mostra a partir de 12 h sem resposta; fica vermelha ao atingir 2 dias.
    if (conv && lastReal && state?.awaitingReply && state.silentHours >= 12) {
      const lastReply = rows.find((m) => m.role === "user" && !m.content.startsWith("[sistema]"));
      const previousFollowUps = await prisma.auditLog.count({
        where: { agencyId, action: "assistant.follow_up", metadata: { path: ["conversationId"], equals: conv.id }, ...(lastReply ? { createdAt: { gt: lastReply.createdAt } } : {}) },
      });
      const lead = leadOf(conv);
      followUp = {
        phone: conv.phone,
        suggestion: suggestFollowUp(lead?.name ?? conv.profileName, previousFollowUps),
        silentLabel: timeAgo(lastReal.createdAt, now),
        needsFollowUp: state.needsFollowUp,
        // Janela de 24 h do WhatsApp: aberta, sai pelo sistema; fechada, só pelo celular (wa.me).
        windowOpen: Boolean(conv.lastInboundAt && now.getTime() - conv.lastInboundAt.getTime() < 24 * 3600_000),
        previousFollowUps,
      };
    }
    messages = rows.reverse().map((m) => ({ id: m.id, author: m.role === "user" ? "contact" : m.role === "assistant" ? "bot" : "team", text: m.content, at: m.createdAt.toISOString() }));
  } else if (kind === "ig" && id) {
    const rows = await prisma.socialInboxMessage.findMany({ where: { threadId: id, thread: { agencyId } }, orderBy: { createdAt: "desc" }, take: 300 });
    messages = rows.reverse().map((m) => ({ id: m.id, author: m.author as InboxMessage["author"], text: m.text, at: m.createdAt.toISOString() }));
  }

  return <InboxView items={items} selected={selected} messages={messages} followUp={followUp} channel={searchParams.canal ?? "todos"} />;
}
