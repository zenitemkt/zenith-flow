export const DEFAULT_FOUR_STAR_TEMPLATE = "Olá, {nome}! Obrigado pela avaliação e por escolher a {empresa}. Ficamos felizes com sua experiência e vamos continuar trabalhando para conquistar a quinta estrela na próxima visita.";
export const DEFAULT_FIVE_STAR_TEMPLATE = "Olá, {nome}! Muito obrigado pelas cinco estrelas. É ótimo saber que sua experiência com a {empresa} foi positiva. Esperamos receber você novamente em breve!";

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

export function renderGoogleReviewTemplate(template: string, input: { reviewerName?: string | null; businessName: string }) {
  const firstName = input.reviewerName?.trim().split(/\s+/)[0] || "cliente";
  return template.replaceAll("{nome}", firstName).replaceAll("{empresa}", input.businessName).trim();
}

export function validateReviewPolicy(input: {
  manualAtOrBelow: number;
  responseTone: string;
  fourStarTemplate: string;
  fiveStarTemplate: string;
}) {
  if (!Number.isInteger(input.manualAtOrBelow) || input.manualAtOrBelow < 1 || input.manualAtOrBelow > 3) return "A fila manual deve abranger notas de 1 a 3.";
  if (!input.responseTone.trim() || input.responseTone.length > 240) return "Informe o tom de voz em até 240 caracteres.";
  if (!input.fourStarTemplate.trim() || !input.fiveStarTemplate.trim()) return "Os modelos de 4 e 5 estrelas são obrigatórios.";
  if (input.fourStarTemplate.length > 1500 || input.fiveStarTemplate.length > 1500) return "Cada modelo pode ter até 1.500 caracteres.";
  return null;
}
