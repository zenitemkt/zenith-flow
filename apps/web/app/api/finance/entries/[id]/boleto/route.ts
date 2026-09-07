import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Anexa um boleto/fatura em PDF já enviado (POST /api/media) a um lançamento — pedido do usuário, 2026-09-07. */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const entry = await prisma.financeEntry.findUnique({ where: { id: params.id } });
  if (!entry || entry.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const mediaAssetId = typeof body?.mediaAssetId === "string" ? body.mediaAssetId : null;
  if (!mediaAssetId) {
    return NextResponse.json({ error: "Envie o arquivo primeiro." }, { status: 400 });
  }

  const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!asset || asset.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }
  if (entry.clientId && asset.clientId !== entry.clientId) {
    return NextResponse.json({ error: "O arquivo precisa estar vinculado ao mesmo cliente do lançamento." }, { status: 400 });
  }

  await prisma.financeEntry.update({ where: { id: entry.id }, data: { boletoAssetId: asset.id } });

  return NextResponse.json({ ok: true });
}

/** Remove o vínculo do boleto — nunca apaga o arquivo em si, só desvincula (onDelete: SetNull, mesmo espírito de collectionTaskId). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const entry = await prisma.financeEntry.findUnique({ where: { id: params.id } });
  if (!entry || entry.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }

  await prisma.financeEntry.update({ where: { id: entry.id }, data: { boletoAssetId: null } });

  return NextResponse.json({ ok: true });
}
