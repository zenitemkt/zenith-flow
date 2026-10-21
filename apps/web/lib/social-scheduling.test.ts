import { describe, expect, it, vi } from "vitest";

// As regras puras não usam o banco; o mock evita abrir conexão ao importar o módulo.
vi.mock("@zenite-mkt/db", () => ({ prisma: {} }));

const { platformForChannel, postFormatFor, spDateTime } = await import("./social-scheduling");

describe("agendador — horário de Brasília", () => {
  it("data + hora digitadas viram o instante certo (UTC-3)", () => {
    expect(spDateTime("2026-10-25", "10:00")?.toISOString()).toBe("2026-10-25T13:00:00.000Z");
    expect(spDateTime("2026-10-25", "23:30")?.toISOString()).toBe("2026-10-26T02:30:00.000Z");
  });

  it("rejeita formatos inválidos", () => {
    expect(spDateTime("25/10/2026", "10:00")).toBeNull();
    expect(spDateTime("2026-10-25", "10h")).toBeNull();
  });
});

describe("agendador — mapeamentos", () => {
  it("canal da peça → rede", () => {
    expect(platformForChannel("INSTAGRAM")).toBe("INSTAGRAM");
    expect(platformForChannel("FACEBOOK")).toBe("FACEBOOK");
    expect(platformForChannel("TIKTOK")).toBeNull();
  });

  it("formato do cadastro → formato da publicação", () => {
    expect(postFormatFor("Reels")).toBe("REEL");
    expect(postFormatFor("Stories")).toBe("STORY");
    expect(postFormatFor("Carrossel")).toBe("FEED");
    expect(postFormatFor(null)).toBe("FEED");
  });
});
