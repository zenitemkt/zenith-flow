import { describe, expect, it } from "vitest";
import { bestTimeFor, weekdayOf } from "./best-times";

describe("melhor horário — dia da semana da data digitada", () => {
  it("descobre o dia pela data, não por quando o cartão foi aberto", () => {
    expect(weekdayOf("2026-10-29")).toBe(4); // quinta
    expect(weekdayOf("2026-10-30")).toBe(5); // sexta
    expect(weekdayOf("2026-11-01")).toBe(0); // domingo
  });

  it("muda o horário sugerido quando a data muda de quinta para sexta", () => {
    expect(bestTimeFor("INSTAGRAM", "2026-10-29")).toBe("13:00");
    expect(bestTimeFor("INSTAGRAM", "2026-10-30")).toBe("11:00");
    expect(bestTimeFor("FACEBOOK", "2026-10-29")).toBe("09:00");
    expect(bestTimeFor("FACEBOOK", "2026-10-30")).toBe("10:00");
  });

  it("devolve null para data inválida ou rede sem tabela", () => {
    expect(bestTimeFor("INSTAGRAM", "")).toBeNull();
    expect(bestTimeFor("INSTAGRAM", "30/10/2026")).toBeNull();
    expect(bestTimeFor("GOOGLE_BUSINESS", "2026-10-29")).toBeNull();
  });
});
