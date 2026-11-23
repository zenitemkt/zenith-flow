import { describe, expect, it } from "vitest";
import { computeOverallScore } from "./competitor-overall-score";

const noInstagram = null;
const noGoogle = { placeId: null, rating: null, reviewCount: null, profileChecks: null };

describe("nota geral do concorrente", () => {
  it("ignora canal sem perfil vinculado e tira a média só do que existe", () => {
    const result = computeOverallScore({ instagram: noInstagram, google: noGoogle, websiteScore: null, websiteSeoScore: 80 });
    expect(result.score).toBe(80);
    expect(result.missing).toEqual(["Instagram", "Google", "Velocidade do site"]);
  });

  it("sem nenhum canal disponível devolve null", () => {
    expect(computeOverallScore({ instagram: noInstagram, google: noGoogle, websiteScore: null, websiteSeoScore: null }).score).toBeNull();
  });

  it("Google vinculado sem nenhuma avaliação pontua 0 na nota, não fica de fora do cálculo", () => {
    const result = computeOverallScore({
      instagram: noInstagram,
      google: { placeId: "abc", rating: null, reviewCount: 0, profileChecks: [{ ok: true }, { ok: true }, { ok: false }] },
      websiteScore: null,
      websiteSeoScore: null,
    });
    expect(result.missing).not.toContain("Google");
    // nota 0 (zero avaliação = zero prova social); completude 2/3 = 66,7 pts → 0*0,8 + 66,7*0,2 ≈ 13
    expect(result.score).toBe(13);
  });

  it("Google com 1 avaliação (pouca, mas não nenhuma) pontua melhor que zero avaliações", () => {
    const semAvaliacao = computeOverallScore({ instagram: noInstagram, google: { placeId: "a", rating: null, reviewCount: 0, profileChecks: null }, websiteScore: null, websiteSeoScore: null });
    const umaAvaliacao = computeOverallScore({ instagram: noInstagram, google: { placeId: "a", rating: 5, reviewCount: 1, profileChecks: null }, websiteScore: null, websiteSeoScore: null });
    expect(umaAvaliacao.score!).toBeGreaterThan(semAvaliacao.score!);
  });

  it("100 avaliações de 4,9 pontuam mais que 1 avaliação de 5,0 — mais prova social", () => {
    const poucasAvaliacoes = computeOverallScore({
      instagram: noInstagram,
      google: { placeId: "a", rating: 5, reviewCount: 1, profileChecks: null },
      websiteScore: null,
      websiteSeoScore: null,
    });
    const muitasAvaliacoes = computeOverallScore({
      instagram: noInstagram,
      google: { placeId: "a", rating: 4.9, reviewCount: 100, profileChecks: null },
      websiteScore: null,
      websiteSeoScore: null,
    });
    expect(muitasAvaliacoes.score!).toBeGreaterThan(poucasAvaliacoes.score!);
    expect(poucasAvaliacoes.score).toBe(71);
    expect(muitasAvaliacoes.score).toBe(96);
  });

  it("Instagram com poucos posts no período pesa menos que com muitos, mesmo com a mesma taxa", () => {
    const poucosPosts = computeOverallScore({ instagram: { engagementRate: 4, postCount: 1 }, google: noGoogle, websiteScore: null, websiteSeoScore: null });
    const muitosPosts = computeOverallScore({ instagram: { engagementRate: 4, postCount: 20 }, google: noGoogle, websiteScore: null, websiteSeoScore: null });
    expect(muitosPosts.score!).toBeGreaterThan(poucosPosts.score!);
    expect(poucosPosts.score).toBe(14);
    expect(muitosPosts.score).toBe(77);
  });

  it("combina os quatro canais com o mesmo peso quando todos têm amostra confiável", () => {
    const result = computeOverallScore({
      instagram: { engagementRate: 2, postCount: 20 },
      google: { placeId: "a", rating: 4, reviewCount: 50, profileChecks: [{ ok: true }, { ok: true }] },
      websiteScore: 80,
      websiteSeoScore: 60,
    });
    expect(result.missing).toEqual([]);
    expect(result.score).toBeGreaterThan(0);
  });
});
