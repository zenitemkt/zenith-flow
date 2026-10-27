import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isTrivialFlow, parseFlow } from "@/lib/instagram-flow-model";
import { Prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

function text(value: unknown, maxLength = 1000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

const MAX_BUTTONS = 3;

function parseButtons(value: unknown): Array<{ text: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is { text?: unknown; url?: unknown } => typeof b === "object" && b !== null)
    .map((b) => ({ text: text(b.text, 20), url: text(b.url, 500) }))
    .filter((b): b is { text: string; url: string } => Boolean(b.text && b.url))
    .slice(0, MAX_BUTTONS);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const rule = await prisma.instagramAutomationRule.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!rule) return NextResponse.json({ error: "Regra não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.active === "boolean") data.active = body.active;
  for (const field of ["keyword", "responseText", "mediaId", "mediaCaption", "mediaPermalink"] as const) {
    if (field in (body ?? {})) data[field] = text(body[field], field === "responseText" ? 1000 : 500);
  }
  if (Array.isArray(body?.buttons)) data.buttons = parseButtons(body.buttons);
  if (body && "flow" in body) {
    const flow = body.flow ? parseFlow(body.flow) : null;
    const first = flow?.[0]?.type === "message" ? flow[0] : null;
    if (first) {
      data.responseText = first.text;
      data.buttons = first.buttons;
    }
    data.flow = flow && !isTrivialFlow(flow) ? (flow as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  }
  if (Array.isArray(body?.publicReplyTexts)) {
    data.publicReplyTexts = body.publicReplyTexts
      .filter((item: unknown): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item: string) => item.trim().slice(0, 300))
      .slice(0, 20);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });

  const updated = await prisma.instagramAutomationRule.update({ where: { id: rule.id }, data });
  return NextResponse.json({ rule: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const rule = await prisma.instagramAutomationRule.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!rule) return NextResponse.json({ error: "Regra não encontrada." }, { status: 404 });

  await prisma.instagramAutomationRule.delete({ where: { id: rule.id } });
  return NextResponse.json({ ok: true });
}
