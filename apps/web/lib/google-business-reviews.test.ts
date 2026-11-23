import { describe, expect, it } from "vitest";
import { classifyGoogleReview, validateReviewPolicy } from "./google-business-reviews";

const enabled = { autoReplyEnabled: true, autoReplyFourStars: true, autoReplyFiveStars: true, manualAtOrBelow: 3, requireCommentForAuto: false };

describe("triagem de avaliações Google", () => {
  it("mantém notas de 1 a 3 na fila humana", () => {
    expect(classifyGoogleReview(1, "Ruim", enabled)).toBe("PENDING_MANUAL");
    expect(classifyGoogleReview(3, "Regular", enabled)).toBe("PENDING_MANUAL");
  });

  it("encaminha 4 e 5 estrelas para automação apenas quando habilitada", () => {
    expect(classifyGoogleReview(4, "Bom", enabled)).toBe("PENDING_AUTO");
    expect(classifyGoogleReview(5, null, enabled)).toBe("PENDING_AUTO");
    expect(classifyGoogleReview(5, "Ótimo", { ...enabled, autoReplyEnabled: false })).toBe("PENDING_MANUAL");
  });

  it("respeita a exigência de comentário", () => {
    expect(classifyGoogleReview(5, " ", { ...enabled, requireCommentForAuto: true })).toBe("PENDING_MANUAL");
  });

  it("rejeita uma política fora da regra 1–3", () => {
    expect(validateReviewPolicy({ manualAtOrBelow: 4, responseTone: "Cordial", extraGuidelines: "" })).toContain("1 a 3");
  });

  it("exige tom de voz e limita o tamanho das orientações extras", () => {
    expect(validateReviewPolicy({ manualAtOrBelow: 2, responseTone: "", extraGuidelines: "" })).toContain("tom de voz");
    expect(validateReviewPolicy({ manualAtOrBelow: 2, responseTone: "Cordial", extraGuidelines: "x".repeat(801) })).toContain("800");
    expect(validateReviewPolicy({ manualAtOrBelow: 2, responseTone: "Cordial", extraGuidelines: "" })).toBeNull();
  });
});
