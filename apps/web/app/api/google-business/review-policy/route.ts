import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { DEFAULT_RESPONSE_TONE, validateReviewPolicy } from "@/lib/google-business-reviews";

export async function PATCH(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores podem alterar esta automação." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const data = {
    autoReplyEnabled: body.autoReplyEnabled === true,
    autoReplyFourStars: body.autoReplyFourStars !== false,
    autoReplyFiveStars: body.autoReplyFiveStars !== false,
    manualAtOrBelow: Number(body.manualAtOrBelow ?? 3),
    responseTone: String(body.responseTone ?? DEFAULT_RESPONSE_TONE).trim(),
    extraGuidelines: String(body.extraGuidelines ?? "").trim() || null,
    notifyLowRatings: body.notifyLowRatings !== false,
    requireCommentForAuto: body.requireCommentForAuto === true,
  };
  const error = validateReviewPolicy({ manualAtOrBelow: data.manualAtOrBelow, responseTone: data.responseTone, extraGuidelines: data.extraGuidelines ?? "" });
  if (error) return NextResponse.json({ error }, { status: 400 });
  const policy = await prisma.$transaction(async (tx) => {
    const saved = await tx.googleBusinessReviewPolicy.upsert({ where: { agencyId: membership.agencyId }, create: { agencyId: membership.agencyId, ...data }, update: data });
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "google_business.review_policy_updated", resourceType: "google_business_review_policy", resourceId: saved.id, metadata: { autoReplyEnabled: saved.autoReplyEnabled, manualAtOrBelow: saved.manualAtOrBelow } } });
    return saved;
  });
  return NextResponse.json({ ok: true, policy });
}
