import { prisma } from "@zenite-mkt/db";
import { classifyGoogleReview, DEFAULT_RESPONSE_TONE } from "./google-business-reviews";
import { generateGoogleReviewReply } from "./google-business-review-reply";
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
  const effective = policy ?? { autoReplyEnabled: false, autoReplyFourStars: true, autoReplyFiveStars: true, manualAtOrBelow: 3, requireCommentForAuto: false, responseTone: DEFAULT_RESPONSE_TONE, extraGuidelines: null, notifyLowRatings: true };
  let status = classifyGoogleReview(payload.starRating, payload.comment, effective);

  // Resposta única por IA, não um modelo fixo: só tenta gerar pra quem entrou na fila automática.
  // Se a IA falhar, cai pra fila manual em vez de deixar uma resposta ruim pronta pra sair sozinha.
  let preparedReply: string | null = null;
  let generationError: string | null = null;
  if (status === "PENDING_AUTO") {
    try {
      preparedReply = await generateGoogleReviewReply({
        starRating: payload.starRating,
        comment: payload.comment ?? null,
        reviewerName: payload.reviewerName ?? null,
        businessName: location.name,
        responseTone: effective.responseTone,
        extraGuidelines: effective.extraGuidelines ?? null,
      });
    } catch (error) {
      generationError = error instanceof Error ? error.message.slice(0, 500) : "Falha ao gerar a resposta com IA.";
      status = "PENDING_MANUAL";
    }
  }

  const existing = await prisma.googleBusinessReview.findUnique({ where: { locationId_externalReviewId: { locationId, externalReviewId: payload.externalReviewId } }, select: { id: true } });
  const review = existing
    ? await prisma.googleBusinessReview.update({ where: { id: existing.id }, data: { reviewerName: payload.reviewerName, reviewerPhotoUrl: payload.reviewerPhotoUrl, starRating: payload.starRating, comment: payload.comment, reviewedAt: payload.reviewedAt, googleUpdatedAt: payload.googleUpdatedAt } })
    : await prisma.$transaction(async (tx) => {
        const created = await tx.googleBusinessReview.create({ data: { agencyId: location.agencyId, clientId: location.clientId, locationId, externalReviewId: payload.externalReviewId, reviewerName: payload.reviewerName, reviewerPhotoUrl: payload.reviewerPhotoUrl, starRating: payload.starRating, comment: payload.comment, reviewedAt: payload.reviewedAt, googleUpdatedAt: payload.googleUpdatedAt, status, replyText: preparedReply, lastError: generationError } });
        await tx.googleBusinessReviewResponse.create({ data: { agencyId: location.agencyId, reviewId: created.id, action: "IMPORTED" } });
        return created;
      });
  if (!existing && payload.starRating <= 3 && effective.notifyLowRatings) await raiseSystemAlert({ agencyId: location.agencyId, key: `google-review:${review.id}`, category: "INTEGRATION", severity: payload.starRating === 1 ? "CRITICAL" : "WARNING", title: `Nova avaliação de ${payload.starRating} estrela${payload.starRating === 1 ? "" : "s"}`, detail: `${location.name} recebeu uma avaliação que precisa de resposta manual.`, href: "/automacoes/avaliacoes-google?status=PENDING_MANUAL" });
  if (!existing && generationError) await raiseSystemAlert({ agencyId: location.agencyId, key: `google-review-ai:${review.id}`, category: "INTEGRATION", severity: "WARNING", title: "Resposta automática por IA falhou", detail: `${location.name}: não consegui gerar a resposta de uma avaliação de ${payload.starRating} estrelas (${generationError}). Ela caiu na fila manual.`, href: "/automacoes/avaliacoes-google?status=PENDING_MANUAL" });
  return review;
}
