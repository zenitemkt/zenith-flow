import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
const cache = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
  delete: vi.fn(async (key: string) => void store.delete(key)),
};
vi.mock("@vercel/functions", () => ({ getCache: () => cache }));

const { TOUCH_SKEW_MS, checkCronWake, decideCronRun, nextHourBoundary, onModelWrite, planNextDueAt, refreshCronPlan } = await import("./cron-wake");

const NOW = Date.parse("2026-11-18T14:20:30.000Z");
const NEXT_HOUR = Date.parse("2026-11-18T15:00:00.000Z");

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("decideCronRun", () => {
  it("sem plano no cache → roda (primeira vez, despejo ou TTL)", () => {
    expect(decideCronRun(NOW, null, null)).toEqual({ run: true, reason: "no-plan" });
  });

  it("plano futuro e nada escrito → pula sem tocar no banco", () => {
    const plan = { nextDueAt: NOW + 10 * 60_000, computedAt: NOW - 60_000 };
    expect(decideCronRun(NOW, plan, null)).toEqual({ run: false, nextDueAt: plan.nextDueAt });
  });

  it("chegou a hora do próximo trabalho → roda", () => {
    expect(decideCronRun(NOW, { nextDueAt: NOW, computedAt: NOW - 60_000 }, null)).toEqual({ run: true, reason: "due" });
  });

  it("escrita na fila depois do cálculo → roda mesmo com plano futuro", () => {
    const plan = { nextDueAt: NOW + 30 * 60_000, computedAt: NOW - 120_000 };
    expect(decideCronRun(NOW, plan, NOW - 30_000)).toEqual({ run: true, reason: "touched" });
  });

  it("escrita pouco antes do cálculo (transação ainda sem COMMIT) também conta", () => {
    const plan = { nextDueAt: NOW + 30 * 60_000, computedAt: NOW - 120_000 };
    expect(decideCronRun(NOW, plan, plan.computedAt - TOUCH_SKEW_MS + 1).run).toBe(true);
  });

  it("escrita bem antes do cálculo já foi vista → pula", () => {
    const plan = { nextDueAt: NOW + 30 * 60_000, computedAt: NOW - 120_000 };
    expect(decideCronRun(NOW, plan, plan.computedAt - TOUCH_SKEW_MS - 1).run).toBe(false);
  });
});

describe("planNextDueAt", () => {
  it("nada agendado → dorme só até a próxima hora cheia (rede de segurança)", () => {
    expect(nextHourBoundary(NOW)).toBe(NEXT_HOUR);
    expect(planNextDueAt(NOW, [])).toBe(NEXT_HOUR);
    expect(planNextDueAt(NOW, [null, undefined, new Date(NEXT_HOUR + 3_600_000)])).toBe(NEXT_HOUR);
  });

  it("pega o candidato mais cedo, inclusive horário já passado (sobrou trabalho)", () => {
    const soon = new Date(NOW + 5 * 60_000);
    const past = new Date(NOW - 60_000);
    expect(planNextDueAt(NOW, [soon, new Date(NOW + 20 * 60_000)])).toBe(soon.getTime());
    expect(planNextDueAt(NOW, [soon, past])).toBe(past.getTime());
  });

  it("na hora cheia exata, a rede de segurança é a hora seguinte", () => {
    expect(nextHourBoundary(NEXT_HOUR)).toBe(NEXT_HOUR + 3_600_000);
  });
});

describe("integração com o cache", () => {
  it("rodada grava plano; minuto seguinte pula; escrita na fila acorda só o job certo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      expect((await checkCronWake("social", NOW)).run).toBe(true);
      const next = await refreshCronPlan("social", async () => [new Date(NOW + 10 * 60_000)]);
      expect(next).toBe(NOW + 10 * 60_000);

      vi.setSystemTime(NOW + TOUCH_SKEW_MS + 60_000);
      expect((await checkCronWake("social", NOW + 60_000)).run).toBe(false);

      await onModelWrite("AssistantBooking"); // não é fila do social
      expect((await checkCronWake("social", NOW + 60_000)).run).toBe(false);

      await onModelWrite("SocialPost");
      expect(await checkCronWake("social", NOW + 120_000)).toEqual({ run: true, reason: "touched" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("falha ao calcular o plano não grava nada (o próximo minuto roda de novo)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await refreshCronPlan("assistant", async () => Promise.reject(new Error("db off")))).toBeNull();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("cache fora do ar → roda como antes (fail-open)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    cache.get.mockRejectedValueOnce(new Error("cache down"));
    expect(await checkCronWake("assistant", NOW)).toEqual({ run: true, reason: "no-plan" });
  });
});
