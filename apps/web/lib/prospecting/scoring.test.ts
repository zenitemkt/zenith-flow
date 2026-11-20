import { describe, expect, it } from "vitest";
import { prospectEmail, prospectPhone, scoreProspect } from "./scoring";

describe("pontuação de prospect", () => {
  it("empresa contatável, sem site e com espaço pra crescer fica quente", () => {
    const result = scoreProspect({
      phoneUnformatted: "+55 19 99876-5432",
      email: "contato@clinica.com.br",
      website: null,
      totalScore: 4.2,
      reviewsCount: 80,
      imageUrls: ["a"],
      openingHours: [{ day: "segunda" }],
    });
    expect(result.score).toBe(10);
    expect(result.temperature).toBe("QUENTE");
    expect(result.potential).toContain("Sem site próprio");
  });

  it("empresa sem telefone e com site bem avaliado fica fria", () => {
    const result = scoreProspect({ website: "https://empresa.com.br", totalScore: 4.9, reviewsCount: 10 });
    expect(result.score).toBe(1);
    expect(result.temperature).toBe("FRIO");
  });

  it("normaliza telefone brasileiro e descarta inválido", () => {
    expect(prospectPhone({ phone: "(19) 3461-2000" })).toBe("551934612000");
    expect(prospectPhone({ phone: "123" })).toBeNull();
  });

  it("aceita só e-mail com formato válido", () => {
    expect(prospectEmail({ emails: ["Contato@Loja.com"] })).toBe("contato@loja.com");
    expect(prospectEmail({ email: "sem-arroba" })).toBeNull();
  });
});
