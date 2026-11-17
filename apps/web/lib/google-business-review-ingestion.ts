import { prisma } from "@zenite-mkt/db";
import { classifyGoogleReview, DEFAULT_FOUR_STAR_TEMPLATE, DEFAULT_FIVE_STAR_TEMPLATE, renderGoogleReviewTemplate } from "./google-business-reviews";
import { raiseSystemAlert } from "./system-alerts";

export interface GoogleBusinessReviewPayload {
  externalReviewId: string;
  reviewerName?: string | null;
  reviewerPhotoUrl?: string | null;
  starRating: number;
  comment?: string | null;
  reviewedAt: Date;
  googleUpdatedAt?: Date | null;
}

/** Adapter seam: o sincronizador oficial só precisa entregar o payload normalizado nesta função. */
export async function ingestGoogleBusinessReview(locationId: string, payload: GoogleBusinessReviewPayload) {
  if (!payload.externalReviewId || !Number.isInteger(payload.starRating) || payload.starRating < 1 || payload.starRating > 5) throw new Error("invalid_google_business_review");
  const location = await prisma.googleBusinessLocation.findUnique({ where: { id: locationId }, select: { id: true, agencyId: true, clientId: true, name: true } });
  if (!location) throw new Error("google_business_location_not_found");
  const policy = await prisma.googleBusinessReviewPolicy.findUnique({ where: { agencyId: location.agencyId } });
  const effective = policy ?? { autoReplyEnabled: false, autoReplyFourStars: true, autoReplyFiveStars: true, manualAtOrBelow: 3, requireCommentForAuto: false, fourStarTemplate: DEFAULT_FOUR_STAR_TEMPLATE, fiveStarTemplate: DEFAULT_FIVE_STAR_TEMPLATE, notifyLowRatings: true };
  const status = classifyGoogleReview(payload.starRating, payload.comment, effective);
  const template = payload.starRating === 5 ? effective.fiveStarTemplate : effective.fourStarTemplate;
  const preparedReply = status === "PENDING_AUTO" ? renderGoogleReviewTemplate(template, { reviewerName: payload.reviewerName, businessName: location.name }) : null;
  const existing = await prisma.googleBusinessReview.findUnique({ where: { locationId_externalReviewId: { locationId, externalReviewId: payload.externalReviewId } }, select: { id: true } });
  const review = existing
    ? await prisma.googleBusinessReview.update({ where: { id: existing.id }, data: { reviewerName: payload.reviewerName, reviewerPhotoUrl: payload.reviewerPhotoUrl, starRating: payload.starRating, comment: payload.comment, reviewedAt: payload.reviewedAt, googleUpdatedAt: payload.googleUpdatedAt } })
    : await prisma.$transaction(async (tx) => {
        const created = await tx.googleBusinessReview.create({ data: { agencyId: location.agencyId, clientId: location.clientId, locationId, externalReviewId: payload.externalReviewId, reviewerName: payload.reviewerName, reviewerPhotoUrl: payload.reviewerPhotoUrl, starRating: payload.starRating, comment: payload.comment, reviewedAt: payload.reviewedAt, googleUpdatedAt: payload.googleUpdatedAt, status, replyText: preparedReply } });
        await tx.googleBusinessReviewResponse.create({ data: { agencyId: location.agencyId, reviewId: created.id, action: "IMPORTED" } });
        return created;
      });
  if (!existing && payload.starRating <= 3 && effective.notifyLowRatings) await raiseSystemAlert({ agencyId: location.agencyId, key: `google-review:${review.id}`, category: "INTEGRATION", severity: payload.starRating === 1 ? "CRITICAL" : "WARNING", title: `Nova avaliação de ${payload.starRating} estrela${payload.starRating === 1 ? "" : "s"}`, detail: `${location.name} recebeu uma avaliação que precisa de resposta manual.`, href: "/automacoes/avaliacoes-google?status=PENDING_MANUAL" });
  return review;
}
