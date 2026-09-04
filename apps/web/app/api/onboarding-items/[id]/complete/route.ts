import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }

  const item = await prisma.onboardingItem.findUnique({
    where: { id: params.id },
    include: { run: { include: { client: true, items: { orderBy: { order: "asc" } } } } },
  });
  if (!item || item.run.client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }
  if (item.status === "BLOQUEADO") {
    return NextResponse.json(
      { error: "Conclua os itens anteriores primeiro." },
      { status: 409 },
    );
  }
  if (item.status === "CONCLUIDO") {
    return NextResponse.json({ ok: true });
  }

  const items = item.run.items;
  const currentIndex = items.findIndex((i) => i.id === item.id);
  const nextItem = items[currentIndex + 1];

  await prisma.$transaction(async (tx) => {
    await tx.onboardingItem.update({
      where: { id: item.id },
      data: { status: "CONCLUIDO", completedAt: new Date(), completedByUserId: session.user.id },
    });

    if (nextItem && nextItem.status === "BLOQUEADO") {
      await tx.onboardingItem.update({ where: { id: nextItem.id }, data: { status: "PENDENTE" } });
    }

    const remaining = items.filter((i) => i.id !== item.id && i.status !== "CONCLUIDO").length;
    if (remaining === 0) {
      await tx.onboardingRun.update({
        where: { id: item.run.id },
        data: { status: "CONCLUIDO", completedAt: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "onboarding_item.completed",
        resourceType: "onboarding_item",
        resourceId: item.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
