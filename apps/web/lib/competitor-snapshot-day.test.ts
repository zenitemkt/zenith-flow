import { describe, expect, it } from "vitest";
import { competitorSnapshotDay } from "./competitor-snapshot-day";

describe("competitorSnapshotDay", () => {
  it("continua no dia local anterior quando UTC já virou à noite em Brasília", () => {
    expect(competitorSnapshotDay(new Date("2026-11-17T00:30:00.000Z")).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });

  it("vira o dia somente à meia-noite de Brasília", () => {
    expect(competitorSnapshotDay(new Date("2026-11-17T03:00:00.000Z")).toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
});
