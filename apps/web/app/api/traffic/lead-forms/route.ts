import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto-secrets";
import { metaGet } from "@/lib/meta-marketing";

/** Formulários instantâneos que já existem na página dos anúncios (para reaproveitar numa campanha). */
export async function GET() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const settings = await prisma.trafficSettings.findUnique({ where: { agencyId: membership.agencyId }, select: { pageConnectionId: true } });
  const page = settings?.pageConnectionId ? await prisma.socialConnection.findFirst({ where: { id: settings.pageConnectionId, agencyId: membership.agencyId } }) : null;
  if (!page) return NextResponse.json({ error: "Escolha a página do Facebook em Configurações." }, { status: 400 });
  try {
    const data = await metaGet<{ data?: { id: string; name: string; status?: string; created_time?: string; leads_count?: number }[] }>(`/${page.externalId}/leadgen_forms`, decryptSecret(page.accessTokenEnc), {
      fields: "id,name,status,created_time,leads_count",
      limit: 100,
    });
    const forms = (data.data ?? [])
      .filter((f) => f.status !== "DELETED" && f.status !== "ARCHIVED")
      .map((f) => ({ id: f.id, name: f.name, status: f.status ?? "", createdAt: f.created_time ?? null, leads: f.leads_count ?? null }));
    return NextResponse.json({ forms });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui listar os formulários." }, { status: 502 });
  }
}
