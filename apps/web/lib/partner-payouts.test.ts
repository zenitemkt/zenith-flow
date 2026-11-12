import { describe, expect, it, vi } from "vitest";

vi.mock("@zenite-mkt/db", () => ({ prisma: {} }));
const { summarizePayout, parseMonthKey, monthKey } = await import("./partner-payouts");

describe("repasse ao sócio — conta do mês", () => {
  it("parte de 3.000, clientes pagaram 1.000, repassei 1.000: não é Pago — parcial, nada pendente agora", () => {
    expect(summarizePayout(200000, 100000, 100000)).toEqual({
      totalCents: 300000,
      openCents: 200000,
      receivedCents: 100000,
      paidCents: 100000,
      pendingCents: 0,
      status: "partial",
    });
  });

  it("parte de 2.000 toda recebida, repassei 1.000: parcial com 1.000 pendente", () => {
    const s = summarizePayout(0, 200000, 100000);
    expect(s.status).toBe("partial");
    expect(s.pendingCents).toBe(100000);
  });

  it("repassado o total da parte: Pago", () => {
    expect(summarizePayout(0, 200000, 200000).status).toBe("paid");
  });

  it("nada repassado ainda: Pendente", () => {
    expect(summarizePayout(50000, 150000, 0)).toMatchObject({ status: "pending", pendingCents: 150000 });
  });

  it("sem parte no mês: nada a repassar", () => {
    expect(summarizePayout(0, 0, 0).status).toBe("nothing");
  });

  it("repassado além do recebido aparece como pendente negativo (adiantamento)", () => {
    expect(summarizePayout(100000, 100000, 150000)).toMatchObject({ status: "partial", pendingCents: -50000 });
  });

  it("mês AAAA-MM", () => {
    expect(parseMonthKey("2026-11")?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(monthKey(new Date("2026-02-01T00:00:00Z"))).toBe("2026-02");
  });
});
