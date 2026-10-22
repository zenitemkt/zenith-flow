import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

/** Configurações de blog automático por agência (Blueprint, seção 5): publicação automática e tom de voz. */
export async function GET() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const agency = await prisma.agency.findUnique({
    where: { id: membership.agencyId },
    select: { blogAutoPublish: true, blogVoiceNotes: true },
  });
  return NextResponse.json({ autoPublish: agency?.blogAutoPublish ?? true, voiceNotes: agency?.blogVoiceNotes ?? "" });
}

export async function PATCH(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem alterar essas configurações." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.autoPublish === "boolean") data.blogAutoPublish = body.autoPublish;
  if (typeof body?.voiceNotes === "string") data.blogVoiceNotes = body.voiceNotes.trim().slice(0, 4000) || null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });

  await prisma.agency.update({ where: { id: membership.agencyId }, data });
  return NextResponse.json({ ok: true });
}
