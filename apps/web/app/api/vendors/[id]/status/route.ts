import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type VendorStatus } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

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

  const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
  if (!vendor || vendor.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status as VendorStatus | undefined;
  if (status !== "HOMOLOGADO" && status !== "BLOQUEADO") {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  await prisma.vendor.update({ where: { id: vendor.id }, data: { status } });

  return NextResponse.json({ ok: true });
}
