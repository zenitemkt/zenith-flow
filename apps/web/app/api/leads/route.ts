import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { normalizeEmail } from "@/lib/leads";
import { prisma } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

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
  const email = normalizeEmail(body?.email);
  const phone = optionalString(body?.phone);
  const company = optionalString(body?.company);
  const source = optionalString(body?.source);

  if (!name) {
    return NextResponse.json({ error: "Informe o nome do lead." }, { status: 400 });
  }

  if (email) {
    const existing = await prisma.lead.findUnique({ where: { agencyId_email: { agencyId: membership.agencyId, email } } });
    if (existing) {
      return NextResponse.json({ error: "Já existe um lead com este e-mail." }, { status: 409 });
    }
  }

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: { agencyId: membership.agencyId, name, email, phone, company, source, createdByUserId: session.user.id },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: created.id, toStatus: "NOVO", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "lead.created",
        resourceType: "lead",
        resourceId: created.id,
      },
    });
    return created;
  });

  return NextResponse.json({ id: lead.id }, { status: 201 });
}
