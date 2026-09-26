import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@zenite-mkt/db";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { LeadIdentityConflictError, upsertLeadSubmission } from "@/lib/lead-contact";

const SOURCE = "Site Zenite Hub";

function text(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function authorized(request: Request): boolean {
  const expected = process.env.SITE_LEADS_SECRET;
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!expected || !provided) return false;
  return timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(provided).digest());
}

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  if (!authorized(request)) return NextResponse.json({ code: "unauthorized", message: "Não autorizado.", correlationId }, { status: 401 });
  const agencyId = process.env.SITE_LEADS_AGENCY_ID;
  if (!agencyId) return NextResponse.json({ code: "not_configured", message: "Integração não configurada.", correlationId }, { status: 503 });

  const integration = await prisma.agency.findUnique({ where: { id: agencyId }, select: { siteLeadIntegrationEnabled: true } });
  if (!integration?.siteLeadIntegrationEnabled) return NextResponse.json({ code: "integration_disabled", message: "Integração desativada.", correlationId }, { status: 503 });

  const body = await request.json().catch(() => null);
  const input = {
    agencyId,
    name: text(body?.name, 160),
    email: text(body?.email, 320),
    phone: text(body?.phone, 80),
    company: text(body?.company, 200),
    source: SOURCE,
    city: text(body?.city, 160),
    interest: text(body?.interest, 120),
    service: text(body?.service, 240),
    employees: text(body?.employees, 120),
    investment: text(body?.investment, 120),
    summary: text(body?.summary, 2_000),
    createOpportunity: "always" as const,
  };
  if (!input.name || !input.email || !input.phone || !input.company || !input.email.includes("@")) {
    return NextResponse.json({ code: "invalid_payload", message: "Dados obrigatórios inválidos.", correlationId }, { status: 400 });
  }

  const recentCount = await prisma.leadSubmission.count({ where: { agencyId, source: SOURCE, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recentCount >= 30) return NextResponse.json({ code: "rate_limited", message: "Muitas solicitações. Tente novamente.", correlationId }, { status: 429 });

  async function ingest() {
    return prisma.$transaction((tx) => upsertLeadSubmission(tx, input as typeof input & { name: string }));
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
      await fireWorkflowTrigger(agencyId, "lead.created", "lead", result.lead.id, {
        leadId: result.lead.id,
        name: result.lead.name,
        email: result.lead.email,
        source: result.lead.source,
      });
    }
    return NextResponse.json(
      { id: result.lead.id, submissionId: result.submission.id, opportunityId: result.opportunity?.id, deduplicated: !result.createdNewLead, correlationId },
      { status: result.createdNewLead ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof LeadIdentityConflictError) return NextResponse.json({ code: "identity_conflict", message: error.message, correlationId }, { status: 409 });
    console.error("site_lead_ingest_failed", { correlationId, agencyId, error });
    return NextResponse.json({ code: "internal_error", message: "Não foi possível cadastrar o lead.", correlationId }, { status: 500 });
  }
}