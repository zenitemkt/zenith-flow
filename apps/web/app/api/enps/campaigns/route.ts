import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canViewEnps } from "@/lib/rbac";
import { DEFAULT_ENPS_QUESTION, DEFAULT_ENPS_COMMENT_PROMPT } from "@/lib/enps";
import { generateEnpsToken } from "@/lib/enps-server";
import { prisma } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Acesso restrito (seção 32.1) — só SUPER_ADMIN/AGENCY_ADMIN/HR, nem todo staff interno. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (!canViewEnps(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  const question = optionalString(body?.question) ?? DEFAULT_ENPS_QUESTION;
  const commentPrompt = optionalString(body?.commentPrompt) ?? DEFAULT_ENPS_COMMENT_PROMPT;
  const headerText = optionalString(body?.headerText);
  const footerText = optionalString(body?.footerText);
  const employeeIds: string[] = Array.isArray(body?.employeeIds)
    ? body.employeeIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (!name) {
    return NextResponse.json({ error: "Dê um nome à pesquisa." }, { status: 400 });
  }
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma pessoa." }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, agencyId: membership.agencyId, status: "ATIVO" },
    include: { user: { select: { email: true } } },
  });

  const skipped: string[] = [];
  const invitesData: { employeeId: string; email: string; token: string }[] = [];
  for (const employee of employees) {
    const email = employee.email ?? employee.user?.email ?? null;
    if (!email) {
      skipped.push(employee.name);
      continue;
    }
    invitesData.push({ employeeId: employee.id, email, token: generateEnpsToken() });
  }

  if (invitesData.length === 0) {
    return NextResponse.json({ error: "Nenhuma das pessoas selecionadas tem e-mail cadastrado." }, { status: 400 });
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.enpsCampaign.create({
      data: {
        agencyId: membership.agencyId,
        name,
        question,
        commentPrompt,
        headerText,
        footerText,
        createdByUserId: session.user.id,
      },
    });
    await tx.enpsInvite.createMany({
      data: invitesData.map((i) => ({ campaignId: created.id, ...i })),
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "enps_campaign.created",
        resourceType: "enps_campaign",
        resourceId: created.id,
        metadata: { inviteCount: invitesData.length },
      },
    });
    return created;
  });

  return NextResponse.json({ id: campaign.id, skipped }, { status: 201 });
}
