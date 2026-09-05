import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { DEFAULT_NPS_QUESTION, DEFAULT_NPS_COMMENT_PROMPT } from "@/lib/nps";
import { generateSurveyToken } from "@/lib/nps-server";
import { prisma } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Seção 32.1: "campanha, pergunta 0-10... público... consentimento." O
 * "público" é resolvido aqui — para cada clientId escolhido, usa o contato
 * principal (ou o primeiro com e-mail) que não tenha `marketingOptOut`.
 * Cliente sem contato elegível é ignorado silenciosamente (reportado na
 * resposta) em vez de falhar a campanha inteira.
 */
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
  const question = optionalString(body?.question) ?? DEFAULT_NPS_QUESTION;
  const commentPrompt = optionalString(body?.commentPrompt) ?? DEFAULT_NPS_COMMENT_PROMPT;
  const headerText = optionalString(body?.headerText);
  const footerText = optionalString(body?.footerText);
  const clientIds: string[] = Array.isArray(body?.clientIds)
    ? body.clientIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (!name) {
    return NextResponse.json({ error: "Dê um nome à pesquisa." }, { status: 400 });
  }
  if (clientIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um cliente." }, { status: 400 });
  }

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, agencyId: membership.agencyId },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
  });

  const skipped: string[] = [];
  const recipientsData: { clientId: string; contactName: string; email: string; token: string }[] = [];
  for (const client of clients) {
    const contact = client.contacts.find((c) => c.email && !c.marketingOptOut);
    if (!contact || !contact.email) {
      skipped.push(client.name);
      continue;
    }
    recipientsData.push({ clientId: client.id, contactName: contact.name, email: contact.email, token: generateSurveyToken() });
  }

  if (recipientsData.length === 0) {
    return NextResponse.json(
      { error: "Nenhum dos clientes selecionados tem contato com e-mail elegível (sem opt-out)." },
      { status: 400 },
    );
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.surveyCampaign.create({
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
    await tx.surveyRecipient.createMany({
      data: recipientsData.map((r) => ({ campaignId: created.id, ...r })),
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "survey_campaign.created",
        resourceType: "survey_campaign",
        resourceId: created.id,
        metadata: { recipientCount: recipientsData.length },
      },
    });
    return created;
  });

  return NextResponse.json({ id: campaign.id, skipped }, { status: 201 });
}
