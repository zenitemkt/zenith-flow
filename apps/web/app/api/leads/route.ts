import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { LeadIdentityConflictError, upsertLeadSubmission } from "@/lib/lead-contact";
import { prisma } from "@zenite-mkt/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  if (!name) return NextResponse.json({ error: "Informe o nome do lead." }, { status: 400 });

  const input = {
    agencyId: membership.agencyId,
    name,
    email: optionalString(body?.email),
    phone: optionalString(body?.phone),
    company: optionalString(body?.company),
    source: optionalString(body?.source) ?? "Cadastro manual",
    actorUserId: session.user.id,
    createOpportunity: "always" as const,
  };

  async function ingest() {
    return prisma.$transaction((tx) => upsertLeadSubmission(tx, input));
  }

  try {
    let result;
    try {
      result = await ingest();
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      result = await ingest();
    }

    if (result.createdNewLead) {
      await fireWorkflowTrigger(membership.agencyId, "lead.created", "lead", result.lead.id, {
        leadId: result.lead.id,
        name: result.lead.name,
        email: result.lead.email,
        source: result.lead.source,
      });
    }

    return NextResponse.json(
      { id: result.lead.id, submissionId: result.submission.id, opportunityId: result.opportunity?.id, deduplicated: !result.createdNewLead },
      { status: result.createdNewLead ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof LeadIdentityConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}