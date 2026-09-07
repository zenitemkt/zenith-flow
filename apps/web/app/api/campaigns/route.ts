import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { reaisToCents } from "@/lib/finance";
import { prisma } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Cria uma campanha (seção 36 do manual) — sem conector externo ainda, tudo cadastrado à mão. */
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  const channel = optionalString(body?.channel);
  if (!name) {
    return NextResponse.json({ error: "Dê um nome à campanha." }, { status: 400 });
  }
  if (!channel) {
    return NextResponse.json({ error: "Informe o canal da campanha." }, { status: 400 });
  }

  const objective = optionalString(body?.objective);
  const utmSource = optionalString(body?.utmSource);
  const utmCampaign = optionalString(body?.utmCampaign);
  const externalId = optionalString(body?.externalId);
  const startDateRaw = optionalString(body?.startDate);
  const endDateRaw = optionalString(body?.endDate);
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  if (startDate && Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Data de início inválida." }, { status: 400 });
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Data de fim inválida." }, { status: 400 });
  }

  const budgetRaw = body?.budget;
  const budgetCents =
    budgetRaw === null || budgetRaw === undefined || budgetRaw === "" ? null : reaisToCents(Number(budgetRaw));
  if (budgetCents !== null && (!Number.isFinite(budgetCents) || budgetCents < 0)) {
    return NextResponse.json({ error: "Informe um orçamento válido." }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      agencyId: membership.agencyId,
      name,
      channel,
      objective,
      startDate,
      endDate,
      budgetCents,
      utmSource,
      utmCampaign,
      externalId,
      ownerUserId: session.user.id,
    },
  });

  return NextResponse.json({ id: campaign.id }, { status: 201 });
}
