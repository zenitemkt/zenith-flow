import { afterEach, describe, expect, it, vi } from "vitest";
import { effectiveCompetitorWebsite, fetchPageSpeedScore, normalizeWebsiteUrl } from "./competitor-pagespeed";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PageSpeed dos concorrentes", () => {
  it("normaliza domínio sem protocolo e recusa protocolos estranhos", () => {
    expect(normalizeWebsiteUrl("exemplo.com.br")).toBe("https://exemplo.com.br/");
    expect(normalizeWebsiteUrl("ftp://exemplo.com.br")).toBeNull();
  });

  it("prioriza o site oficial manual e volta ao link da bio quando ele é removido", () => {
    expect(effectiveCompetitorWebsite({ website: "https://linktr.ee/perfil", websiteOverride: "empresa.com.br" })).toBe("https://empresa.com.br/");
    expect(effectiveCompetitorWebsite({ website: "https://linktr.ee/perfil", websiteOverride: null })).toBe("https://linktr.ee/perfil");
  });

  it("converte a nota decimal do Lighthouse para 0 a 100", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult: { categories: { performance: { score: 0.87 } } } }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPageSpeedScore("https://exemplo.com.br")).toBe(87);
    const requestUrl = new URL(fetchMock.mock.calls[0]![0]);
    expect(requestUrl.searchParams.get("strategy")).toBe("mobile");
    expect(requestUrl.searchParams.get("category")).toBe("performance");
  });
});
