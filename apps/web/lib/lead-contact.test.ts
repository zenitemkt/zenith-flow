import { describe, expect, it } from "vitest";
import { mostCompleteName, normalizePhone, splitContactName } from "./lead-contact";

describe("identidade contínua do Lead", () => {
  it("normaliza o mesmo telefone brasileiro em formatos diferentes", () => {
    expect(normalizePhone("(19) 99999-9999")).toBe("5519999999999");
    expect(normalizePhone("+55 19 99999-9999")).toBe("5519999999999");
    expect(normalizePhone("019999999999")).toBe("5519999999999");
  });

  it("prefere o nome mais completo sem apagar sobrenome", () => {
    expect(mostCompleteName("Gabriel", "Gabriel Sarmento")).toBe("Gabriel Sarmento");
    expect(mostCompleteName("Gabriel Sarmento", "Gabriel")).toBe("Gabriel Sarmento");
    expect(mostCompleteName("Gabriel S.", "Gabriel Sarmento")).toBe("Gabriel Sarmento");
  });

  it("separa nome e sobrenome para exibição no cartão", () => {
    expect(splitContactName("Gabriel Espindola Sarmento")).toEqual({
      firstName: "Gabriel",
      lastName: "Espindola Sarmento",
    });
    expect(splitContactName("Gabriel")).toEqual({ firstName: "Gabriel", lastName: null });
  });
});