import { NextResponse } from "next/server";
import { prisma, Prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { parsePlan } from "@/lib/traffic-campaigns";
import { decryptSecret } from "@/lib/crypto-secrets";
import { MetaWriteError, metaGet } from "@/lib/meta-marketing";

/** A campanha ainda existe na Meta? (apagada ou não encontrada = false; sem como checar = true). */
async function stillOnMeta(agencyId: string, metaCampaignId: string): Promise<boolean> {
  const ads = await prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId, platform: "META" } }, select: { accessTokenEnc: true, status: true } });
  if (!ads || ads.status !== "ACTIVE") return true;
  try {
    const data = await metaGet<{ effective_status?: string; status?: string }>(`/${metaCampaignId}`, decryptSecret(ads.accessTokenEnc), { fields: "effective_status,status" });
    return !["DELETED", "ARCHIVED"].includes(data.effective_status ?? data.status ?? "");
  } catch (error) {
    // A Meta responde erro (objeto inexistente) quando a campanha foi apagada.
    if (error instanceof MetaWriteError && error.code === 100) return false;
    const message = error instanceof Error ? error.message : "";
    return !/does not exist|cannot be loaded|nonexisting|n[aã]o existe|Unsupported get request|deleted/i.test(message);
  }
}

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
  // Só some daqui depois de apagada na Meta (o Gerenciador é quem apaga de verdade).
  if (row.metaCampaignId && (await stillOnMeta(membership.agencyId, row.metaCampaignId))) {
    return NextResponse.json({ error: "Essa campanha ainda existe na Meta. Apague pelo Gerenciador de Anúncios e tente de novo." }, { status: 409 });
  }
  await prisma.trafficCampaign.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
