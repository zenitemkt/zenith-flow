import { describe, expect, it } from "vitest";
import { computeOverallScore } from "./competitor-overall-score";

describe("nota geral do concorrente", () => {
  it("ignora canais sem dado e tira a média só do que existe", () => {
    const result = computeOverallScore({ instagramEngagementRate: null, googleRating: 5, websiteScore: null, websiteSeoScore: null });
    expect(result.score).toBe(100);
    expect(result.missing).toEqual(["Instagram", "Velocidade do site", "SEO do site"]);
  });

  it("sem nenhum canal medido devolve null", () => {
    expect(computeOverallScore({ instagramEngagementRate: null, googleRating: null, websiteScore: null, websiteSeoScore: null }).score).toBeNull();
  });

  it("combina os quatro canais com o mesmo peso", () => {
    const result = computeOverallScore({ instagramEngagementRate: 2, googleRating: 4, websiteScore: 80, websiteSeoScore: 60 });
    // Instagram: 2/4*100=50; Google: 4/5*100=80; site: 80; seo: 60 → média 67,5
    expect(result.score).toBe(68);
  });
});
