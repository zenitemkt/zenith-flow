import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isSafeHttpUrl, isTrivialFlow, parseFlow } from "@/lib/instagram-flow-model";
import { Prisma } from "@zenite-mkt/db";

function text(value: unknown, maxLength = 1000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

const VALID_TRIGGERS = ["story_reply", "comment", "direct_message"];
const MAX_BUTTONS = 3;

function parseButtons(value: unknown): Array<{ text: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is { text?: unknown; url?: unknown } => typeof b === "object" && b !== null)
    .map((b) => ({ text: text(b.text, 20), url: text(b.url, 500) }))
    .filter((b): b is { text: string; url: string } => Boolean(b.text && b.url && isSafeHttpUrl(b.url)))
    .slice(0, MAX_BUTTONS);
}

/** Regras do mini-chat de Instagram (Blueprint, seção 4.6) — uma tela por cliente da agência. */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId") ?? "";
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const rules = await prisma.instagramAutomationRule.findMany({ where: { agencyId: membership.agencyId, clientId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const clientId = text(body?.clientId, 60) ?? "";
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const triggerType = text(body?.triggerType, 30) ?? "";
  if (!VALID_TRIGGERS.includes(triggerType)) return NextResponse.json({ error: "triggerType inválido." }, { status: 400 });
  // Com sequência, a primeira mensagem dela vira responseText/buttons (lista e motor antigo continuam lendo daí).
  const flow = body?.flow ? parseFlow(body.flow) : null;
  const first = flow?.[0]?.type === "message" ? flow[0] : null;
  const responseText = first?.text ?? text(body?.responseText, 1000);
  if (!responseText) return NextResponse.json({ error: "Mensagem privada é obrigatória." }, { status: 400 });

  const keyword = text(body?.keyword, 100);
  const buttons = first ? first.buttons.map((b) => ({ text: b.text, url: b.url })) : parseButtons(body?.buttons);
  const mediaId = triggerType === "comment" ? text(body?.mediaId, 100) : null;
  const mediaCaption = triggerType === "comment" ? text(body?.mediaCaption, 300) : null;
  const mediaPermalink = triggerType === "comment" ? text(body?.mediaPermalink, 300) : null;
  const publicReplyTexts =
    triggerType === "comment" && Array.isArray(body?.publicReplyTexts)
      ? body.publicReplyTexts.filter((item: unknown): item is string => typeof item === "string" && Boolean(item.trim())).map((item: string) => item.trim().slice(0, 300)).slice(0, 20)
      : [];

  const rule = await prisma.instagramAutomationRule.create({
    data: {
      agencyId: membership.agencyId,
      clientId,
      triggerType,
      keyword,
      responseText,
      buttons,
      mediaId,
      mediaCaption,
      mediaPermalink,
      publicReplyTexts,
      flow: flow && !isTrivialFlow(flow) ? (flow as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
