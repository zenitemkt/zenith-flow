import { NextResponse } from "next/server";
import { prisma, Prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { parsePlan } from "@/lib/traffic-campaigns";

/** Andamento do envio (a tela consulta enquanto sobe). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const row = await prisma.trafficCampaign.findFirst({ where: { id: params.id, agencyId: membership.agencyId }, select: { status: true, progress: true, lastError: true } });
  if (!row) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  const log = ((row.progress ?? {}) as { log?: unknown }).log;
  return NextResponse.json({ status: row.status, lastError: row.lastError, log: Array.isArray(log) ? log.filter((l) => typeof l === "string") : [] });
}

/** Salva o plano do rascunho. Campanha já enviada não muda por aqui. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const row = await prisma.trafficCampaign.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!row) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (row.status === "SUBMITTED" || row.status === "SUBMITTING") return NextResponse.json({ error: "Campanha já enviada para a Meta." }, { status: 409 });
  const body = await request.json().catch(() => null);
  const plan = parsePlan(body?.plan);
  await prisma.trafficCampaign.update({ where: { id: row.id }, data: { name: plan.name, plan: plan as unknown as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true });
}

/** Apaga rascunho (só o que nunca começou a subir). */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const row = await prisma.trafficCampaign.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!row) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (row.metaCampaignId) return NextResponse.json({ error: "Essa campanha já tem partes na Meta. Pause ou apague pelo Gerenciador de Anúncios." }, { status: 409 });
  await prisma.trafficCampaign.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
