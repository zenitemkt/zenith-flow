import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canTransitionVendorOrder } from "@/lib/vendors";
import { prisma, type VendorOrderStatus } from "@zenith/db";

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

  const order = await prisma.vendorOrder.findUnique({
    where: { id: params.id },
    include: { vendor: true },
  });
  if (!order || order.vendor.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Ordem não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as VendorOrderStatus | undefined;
  if (!toStatus || !canTransitionVendorOrder(order.status, toStatus)) {
    return NextResponse.json(
      { error: `Não é possível mudar de ${order.status} para ${toStatus}.` },
      { status: 400 },
    );
  }

  await prisma.vendorOrder.update({ where: { id: order.id }, data: { status: toStatus } });

  return NextResponse.json({ ok: true });
}
