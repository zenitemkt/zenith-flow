import { describe, expect, it } from "vitest";
import { monthStart, parseGoalTarget, parseMonthParam, periodEnd, periodStartFor, spYearMonth } from "./goal-periods";

describe("períodos das metas (fuso de São Paulo)", () => {
  it("mês começa à meia-noite de São Paulo (03:00 UTC)", () => {
    expect(monthStart(2026, 9).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("trimestre normaliza para o primeiro mês", () => {
    expect(periodStartFor("QUARTERLY", 2026, 10).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(periodStartFor("QUARTERLY", 2026, 4).toISOString()).toBe("2026-04-01T03:00:00.000Z");
  });

  it("fim do período vira o ano corretamente", () => {
    expect(periodEnd("MONTHLY", monthStart(2026, 11)).toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(periodEnd("QUARTERLY", monthStart(2026, 9)).toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("lê o mês no fuso de SP (00:30 UTC do dia 1 ainda é mês anterior)", () => {
    expect(spYearMonth(new Date("2026-11-01T00:30:00Z"))).toEqual({ year: 2026, month: 9 });
  });

  it("parâmetro inválido cai no mês atual", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(parseMonthParam("2026-13", now)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam("2027-02", now)).toEqual({ year: 2027, month: 1 });
  });
});

describe("parseGoalTarget", () => {
  it("dinheiro em formato brasileiro vira centavos", () => {
    expect(parseGoalTarget("30.000", true)).toBe(3_000_000);
    expect(parseGoalTarget("R$ 1.500,50", true)).toBe(150_050);
    expect(parseGoalTarget("1234.56", true)).toBe(123_456);
  });

  it("contagem aceita só inteiro positivo", () => {
    expect(parseGoalTarget("20", false)).toBe(20);
    expect(parseGoalTarget("0", false)).toBeNull();
    expect(parseGoalTarget("", false)).toBeNull();
  });
});
