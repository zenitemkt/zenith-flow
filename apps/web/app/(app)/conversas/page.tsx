import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { InboxView, type InboxItem, type InboxMessage } from "./InboxView";

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
  const clientIds = Array.from(new Set(igThreads.map((t) => t.clientId).filter((x): x is string => Boolean(x))));
  const clients = clientIds.length ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const items: InboxItem[] = [
    ...waConvs.map((c) => ({
      key: `wa:${c.id}`,
      channel: "WHATSAPP" as const,
      name: c.profileName || `+${c.phone}`,
      sub: `+${c.phone}`,
      preview: c.messages[0]?.content ?? "",
      lastAt: (c.messages[0]?.createdAt ?? c.updatedAt).toISOString(),
      mode: c.mode as "bot" | "human",
      classification: c.classification,
      account: "Milena",
    })),
    ...igThreads.map((t) => ({
      key: `ig:${t.id}`,
      channel: "INSTAGRAM" as const,
      name: t.participantName || (t.participantUsername ? `@${t.participantUsername}` : "Contato do Instagram"),
      sub: t.participantUsername ? `@${t.participantUsername}` : "",
      preview: t.messages[0]?.text ?? "",
      lastAt: t.lastMessageAt.toISOString(),
      mode: null,
      classification: null,
      account: (t.clientId && clientName.get(t.clientId)) || "Instagram",
    })),
  ].sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const selected = searchParams.c ?? null;
  let messages: InboxMessage[] = [];
  const [kind, id] = (selected ?? "").split(":");
  if (kind === "wa" && id) {
    const rows = await prisma.assistantMessage.findMany({ where: { conversationId: id, conversation: { agencyId } }, orderBy: { createdAt: "desc" }, take: 300 });
    messages = rows.reverse().map((m) => ({ id: m.id, author: m.role === "user" ? "contact" : m.role === "assistant" ? "bot" : "team", text: m.content, at: m.createdAt.toISOString() }));
  } else if (kind === "ig" && id) {
    const rows = await prisma.socialInboxMessage.findMany({ where: { threadId: id, thread: { agencyId } }, orderBy: { createdAt: "desc" }, take: 300 });
    messages = rows.reverse().map((m) => ({ id: m.id, author: m.author as InboxMessage["author"], text: m.text, at: m.createdAt.toISOString() }));
  }

  return <InboxView items={items} selected={selected} messages={messages} channel={searchParams.canal ?? "todos"} />;
}
