import { NextResponse } from "next/server";
import { Prisma, prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { encryptSecret } from "@/lib/crypto-secrets";
import { mergeProspectingConfig } from "@/lib/prospecting/config";

/** Salva nichos/cidades/limites e (opcional) a chave do Apify da prospecção automática da agência. */
export async function PUT(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const config = mergeProspectingConfig(body?.config);
  const token = typeof body?.apifyToken === "string" ? body.apifyToken.trim() : "";
  if (token && !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return NextResponse.json({ error: "Chave do Apify em formato inválido." }, { status: 400 });

  const data = { config: config as unknown as Prisma.InputJsonValue, ...(token ? { apifyTokenEnc: encryptSecret(token) } : {}) };
  await prisma.prospectingSettings.upsert({ where: { agencyId: membership.agencyId }, create: { agencyId: membership.agencyId, ...data }, update: data });
  return NextResponse.json({ ok: true, config });
}
