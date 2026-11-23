export const DEFAULT_RESPONSE_TONE = "Profissional, cordial e específico";

export interface ReviewPolicyInput {
  autoReplyEnabled: boolean;
  autoReplyFourStars: boolean;
  autoReplyFiveStars: boolean;
  manualAtOrBelow: number;
  requireCommentForAuto: boolean;
}

export type ReviewQueue = "PENDING_AUTO" | "PENDING_MANUAL";

export function classifyGoogleReview(stars: number, comment: string | null | undefined, policy: ReviewPolicyInput): ReviewQueue {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error("A nota deve estar entre 1 e 5.");
  if (stars <= policy.manualAtOrBelow) return "PENDING_MANUAL";
  if (!policy.autoReplyEnabled) return "PENDING_MANUAL";
  if (policy.requireCommentForAuto && !comment?.trim()) return "PENDING_MANUAL";
  if (stars === 4 && policy.autoReplyFourStars) return "PENDING_AUTO";
  if (stars === 5 && policy.autoReplyFiveStars) return "PENDING_AUTO";
  return "PENDING_MANUAL";
}

export function validateReviewPolicy(input: { manualAtOrBelow: number; responseTone: string; extraGuidelines: string }) {
  if (!Number.isInteger(input.manualAtOrBelow) || input.manualAtOrBelow < 1 || input.manualAtOrBelow > 3) return "A fila manual deve abranger notas de 1 a 3.";
  if (!input.responseTone.trim() || input.responseTone.length > 240) return "Informe o tom de voz em até 240 caracteres.";
  if (input.extraGuidelines.length > 800) return "As orientações extras podem ter até 800 caracteres.";
  return null;
}
