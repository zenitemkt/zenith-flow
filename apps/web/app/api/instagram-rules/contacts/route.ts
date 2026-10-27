import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";

/** Contatos do mini-chat (quem já conversou), com etiquetas, respostas salvas e em que sequência estão. */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const tag = url.searchParams.get("tag")?.trim() || null;
  const contacts = await prisma.instagramContact.findMany({
    where: { agencyId: membership.agencyId, clientId, ...(tag ? { tags: { has: tag } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { status: true, rule: { select: { keyword: true, triggerType: true } } } } },
  });

  return NextResponse.json({
    contacts: contacts.map((c) => ({
      id: c.id,
      username: c.username,
      name: c.name,
      tags: c.tags,
      fields: c.fields,
      lastInboundAt: c.lastInboundAt,
      lastSession: c.sessions[0] ? { status: c.sessions[0].status, keyword: c.sessions[0].rule.keyword, triggerType: c.sessions[0].rule.triggerType } : null,
    })),
  });
}
