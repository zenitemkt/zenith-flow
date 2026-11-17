import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPageSpeedScore, normalizeWebsiteUrl } from "./competitor-pagespeed";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PageSpeed dos concorrentes", () => {
  it("normaliza domínio sem protocolo e recusa protocolos estranhos", () => {
    expect(normalizeWebsiteUrl("exemplo.com.br")).toBe("https://exemplo.com.br/");
    expect(normalizeWebsiteUrl("ftp://exemplo.com.br")).toBeNull();
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
