import { describe, expect, it, vi } from "vitest";

vi.mock("@zenite-mkt/db", () => ({ prisma: {} }));
const { sourceLabel, referrerChannel } = await import("./attribution");

describe("fontes de tráfego — nomes legíveis", () => {
  it("códigos curtos da Meta viram o nome do posicionamento", () => {
    expect(sourceLabel("an")).toBe("Meta Ads — Audience Network (an)");
    expect(sourceLabel("IG")).toBe("Meta Ads — Instagram (ig)");
    expect(sourceLabel("fb")).toBe("Meta Ads — Facebook (fb)");
    expect(sourceLabel("newsletter")).toBe("newsletter");
  });

  it("buscadores viram busca orgânica; outros sites, orgânico pelo nome", () => {
    expect(referrerChannel("www.google.com")).toBe("Busca orgânica (Google)");
    expect(referrerChannel("www.google.com.br")).toBe("Busca orgânica (Google)");
    expect(referrerChannel("www.bing.com")).toBe("Busca orgânica (Bing)");
    expect(referrerChannel("l.instagram.com")).toBe("Orgânico (l.instagram.com)");
  });
});
