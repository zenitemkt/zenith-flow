import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { DEFAULT_RESPONSE_TONE } from "@/lib/google-business-reviews";
import { generateGoogleReviewReply } from "@/lib/google-business-review-reply";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; text?: string } | null;
  const action = body?.action;

  if (action === "generate") {
    const review = await prisma.googleBusinessReview.findFirst({ where: { id: params.id, agencyId: membership.agencyId }, select: { starRating: true, comment: true, reviewerName: true, location: { select: { name: true } } } });
    if (!review) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    const policy = await prisma.googleBusinessReviewPolicy.findUnique({ where: { agencyId: membership.agencyId }, select: { responseTone: true, extraGuidelines: true } });
    try {
      const text = await generateGoogleReviewReply({
        starRating: review.starRating,
        comment: review.comment,
        reviewerName: review.reviewerName,
        businessName: review.location.name,
        responseTone: policy?.responseTone ?? DEFAULT_RESPONSE_TONE,
        extraGuidelines: policy?.extraGuidelines ?? null,
      });
      return NextResponse.json({ ok: true, text });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar a resposta." }, { status: 502 });
    }
  }

  const text = body?.text?.trim() ?? "";
  if (!action || !["draft", "approve", "ignore"].includes(action)) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  if (action !== "ignore" && (!text || text.length > 1500)) return NextResponse.json({ error: "A resposta deve ter entre 1 e 1.500 caracteres." }, { status: 400 });
  const review = await prisma.googleBusinessReview.findFirst({ where: { id: params.id, agencyId: membership.agencyId }, select: { id: true } });
  if (!review) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
  const status = action === "draft" ? "DRAFT" : action === "approve" ? "APPROVED" : "IGNORED";
  const historyAction = action === "draft" ? "DRAFT_SAVED" : action === "approve" ? "APPROVED" : "IGNORED";
  await prisma.$transaction([
    prisma.googleBusinessReview.update({ where: { id: review.id }, data: { status, replyText: action === "ignore" ? null : text, lastError: null } }),
    prisma.googleBusinessReviewResponse.create({ data: { agencyId: membership.agencyId, reviewId: review.id, action: historyAction, text: action === "ignore" ? null : text, actorUserId: session.user.id } }),
    prisma.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: `google_business.review_${action}`, resourceType: "google_business_review", resourceId: review.id } }),
  ]);
  return NextResponse.json({ ok: true, status });
}
