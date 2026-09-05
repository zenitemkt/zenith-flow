import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** Seção 39: "Lead... pode converter para Client existente." Aqui: sempre cria um Client novo (Prospect), a partir dos dados do lead. */
export async function POST(_request: Request, { params }: RouteParams) {
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

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead || lead.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }
  if (lead.status !== "QUALIFICADO") {
    return NextResponse.json({ error: "Só é possível converter um lead qualificado." }, { status: 400 });
  }

  const client = await prisma.$transaction(async (tx) => {
    const createdClient = await tx.client.create({
      data: { agencyId: membership.agencyId, name: lead.company || lead.name, email: lead.email, phone: lead.phone },
    });
    await tx.clientStatusHistory.create({
      data: { clientId: createdClient.id, toStatus: "PROSPECT", actorUserId: session.user.id },
    });
    if (lead.email || lead.phone || lead.name) {
      await tx.clientContact.create({
        data: {
          clientId: createdClient.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          isPrimary: true,
        },
      });
    }
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTIDO", convertedClientId: createdClient.id },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, fromStatus: lead.status, toStatus: "CONVERTIDO", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "lead.converted",
        resourceType: "lead",
        resourceId: lead.id,
        metadata: { clientId: createdClient.id },
      },
    });
    return createdClient;
  });

  return NextResponse.json({ clientId: client.id }, { status: 201 });
}
