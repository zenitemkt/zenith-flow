import { describe, expect, it } from "vitest";
import { generateCompetitorAdsToken, hashCompetitorAdsToken, parseCompetitorAdsPayload, tokenMatchesCompetitorAdsHash } from "@/lib/competitor-ads";

describe("token de anúncios de concorrentes", () => {
  it("gera segredo forte e valida somente o valor original", () => {
    const token = generateCompetitorAdsToken();
    const hash = hashCompetitorAdsToken(token);
    expect(token).toMatch(/^zca_[A-Za-z0-9_-]{40,}$/);
    expect(hash).toHaveLength(64);
    expect(tokenMatchesCompetitorAdsHash(token, hash)).toBe(true);
    expect(tokenMatchesCompetitorAdsHash(`${token}x`, hash)).toBe(false);
  });
});

describe("parseCompetitorAdsPayload", () => {
  it("normaliza, remove duplicatas e rejeita URLs inseguras", () => {
    const ads = parseCompetitorAdsPayload({ ads: [
      { adArchiveId: " 123 ", platforms: ["Instagram", "Instagram"], bodyText: " Texto ", creativeUrls: ["https://cdn.example/a.jpg", "javascript:alert(1)"], linkUrl: "http://inseguro.test" },
      { adArchiveId: "123", headline: "Versão mais recente" },
    ] });
    expect(ads).toHaveLength(1);
    expect(ads[0]).toEqual(expect.objectContaining({ adArchiveId: "123", headline: "Versão mais recente" }));
    expect(ads[0]!.linkUrl).toBeNull();
  });

  it("aceita lote vazio para encerrar anúncios que sumiram", () => {
    expect(parseCompetitorAdsPayload({ ads: [] })).toEqual([]);
  });

  it("recusa mais de 500 anúncios", () => {
    expect(() => parseCompetitorAdsPayload({ ads: Array.from({ length: 501 }, (_, index) => ({ adArchiveId: String(index) })) })).toThrow(/500/);
  });
});
