import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@zenite-mkt/db";
import { slugify, randomSuffix } from "@/lib/slug";
import { DEFAULT_ONBOARDING_TEMPLATE_NAME, DEFAULT_ONBOARDING_ITEMS } from "@/lib/onboarding";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/pipeline";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const agencyName = typeof body?.agencyName === "string" ? body.agencyName.trim() : "";
  if (!agencyName) {
    return NextResponse.json({ error: "Informe o nome da agência." }, { status: 400 });
  }

  const baseSlug = slugify(agencyName) || "agencia";
  const slug = `${baseSlug}-${randomSuffix()}`;

  const result = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({ data: { name: agencyName, slug } });
    const workspace = await tx.workspace.create({
      data: { agencyId: agency.id, name: agencyName, kind: "AGENCY" },
    });
    await tx.membership.create({
      data: {
        userId: session.user.id,
        email: session.user.email,
        agencyId: agency.id,
        workspaceId: workspace.id,
        role: "AGENCY_ADMIN",
        status: "ACTIVE",
      },
    });
    await tx.onboardingTemplate.create({
      data: {
        agencyId: agency.id,
        name: DEFAULT_ONBOARDING_TEMPLATE_NAME,
        items: {
          create: DEFAULT_ONBOARDING_ITEMS.map((item, index) => ({
            title: item.title,
            description: item.description,
            order: index,
          })),
        },
      },
    });
    await tx.pipelineStage.createMany({
      data: DEFAULT_PIPELINE_STAGES.map((stage, index) => ({ agencyId: agency.id, ...stage, order: index })),
    });
    await tx.auditLog.create({
      data: {
        agencyId: agency.id,
        actorUserId: session.user.id,
        actorType: "user",
        action: "agency.created",
        resourceType: "agency",
        resourceId: agency.id,
      },
    });
    return { agencyId: agency.id, workspaceId: workspace.id };
  });

  return NextResponse.json(result, { status: 201 });
}
