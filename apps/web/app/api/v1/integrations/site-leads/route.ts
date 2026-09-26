import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@zenite-mkt/db";
import { normalizeEmail } from "@/lib/leads";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { createInitialOpportunityForLead } from "@/lib/lead-pipeline";

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

  const integration = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { siteLeadIntegrationEnabled: true },
  });
  if (!integration?.siteLeadIntegrationEnabled) {
    return NextResponse.json({ code: "integration_disabled", message: "Integração desativada.", correlationId }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const name = text(body?.name, 160);
  const email = normalizeEmail(text(body?.email, 320));
  const phone = text(body?.phone, 80);
  const company = text(body?.company, 200);
  if (!name || !email || !phone || !company || !email.includes("@")) return NextResponse.json({ code: "invalid_payload", message: "Dados obrigatórios inválidos.", correlationId }, { status: 400 });

  const existing = await prisma.lead.findUnique({ where: { agencyId_email: { agencyId, email } } });
  if (existing) return NextResponse.json({ id: existing.id, deduplicated: true, correlationId });
  const recentCount = await prisma.lead.count({ where: { agencyId, source: SOURCE, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recentCount >= 30) return NextResponse.json({ code: "rate_limited", message: "Muitas solicitações. Tente novamente.", correlationId }, { status: 429 });

  const details = [["Cidade", text(body?.city, 160)], ["Interesse", text(body?.interest, 120)], ["Serviço", text(body?.service, 240)], ["Funcionários", text(body?.employees, 120)], ["Investimento mensal", text(body?.investment, 120)], ["Resumo", text(body?.summary, 2_000)]].filter((entry): entry is [string, string] => Boolean(entry[1]));
  try {
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({ data: { agencyId, name, email, phone, company, source: SOURCE } });
      await tx.leadStatusHistory.create({ data: { leadId: created.id, toStatus: "NOVO" } });
      await createInitialOpportunityForLead(tx, { agencyId, leadId: created.id, leadName: created.name });
      if (details.length) await tx.leadNote.create({ data: { leadId: created.id, body: details.map(([label, value]) => `${label}: ${value}`).join("\n") } });
      await tx.auditLog.create({ data: { agencyId, actorType: "integration", action: "lead.created", resourceType: "lead", resourceId: created.id, metadata: { source: SOURCE, correlationId } } });
      return created;
    });
    await fireWorkflowTrigger(agencyId, "lead.created", "lead", lead.id, { leadId: lead.id, name: lead.name, email: lead.email, source: lead.source });
    return NextResponse.json({ id: lead.id, deduplicated: false, correlationId }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await prisma.lead.findUnique({ where: { agencyId_email: { agencyId, email } } });
      if (duplicate) return NextResponse.json({ id: duplicate.id, deduplicated: true, correlationId });
    }
    console.error("site_lead_ingest_failed", { correlationId, agencyId, error });
    return NextResponse.json({ code: "internal_error", message: "Não foi possível cadastrar o lead.", correlationId }, { status: 500 });
  }
}
