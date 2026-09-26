import { describe, expect, it } from "vitest";
import { resolvePipelinePeriod } from "./pipeline-period";

const now = new Date("2026-09-26T15:00:00.000Z");

describe("resolvePipelinePeriod", () => {
  it("inclui hoje nos últimos 7 dias", () => {
    const result = resolvePipelinePeriod({ period: "last7" }, now);
    expect(result.createdAt?.gte?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(result.createdAt?.lt?.toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("resolve um mês específico", () => {
    const result = resolvePipelinePeriod({ period: "month", month: "2025-02" }, now);
    expect(result.createdAt?.gte?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
    expect(result.createdAt?.lt?.toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });

  it("inclui o último dia do período personalizado", () => {
    const result = resolvePipelinePeriod({ period: "custom", from: "2026-09-01", to: "2026-09-26" }, now);
    expect(result.createdAt?.lt?.toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });
});
