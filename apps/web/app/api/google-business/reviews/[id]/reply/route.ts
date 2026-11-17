import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; text?: string } | null;
  const action = body?.action;
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
