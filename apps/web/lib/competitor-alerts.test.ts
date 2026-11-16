import { describe, expect, it } from "vitest";
import { detectCompetitorAlerts, type CompetitorAlertInput, type CompetitorAlertPost } from "@/lib/competitor-alerts";
import { alertTypeOfKey } from "@/lib/system-alerts";

const NOW = new Date("2026-11-16T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY);
}

function post(id: string, days: number, engagement = 10, mediaType = "IMAGE", mediaProductType: string | null = null): CompetitorAlertPost {
  return { id, timestamp: daysAgo(days), mediaType, mediaProductType, likeCount: engagement, commentsCount: 0 };
}

function input(overrides: Partial<CompetitorAlertInput> = {}): CompetitorAlertInput {
  return { id: "competitor-1", username: "rival", posts: [], snapshots: [], ...overrides };
}

describe("detectCompetitorAlerts", () => {
  it("registra as chaves no tipo configuravel de concorrentes", () => {
    expect(alertTypeOfKey("competitor:viral:post-1")).toBe("competitor");
  });

  it("detecta post recente com pelo menos 3x a media quando ha 10 posts", () => {
    const posts = Array.from({ length: 9 }, (_, index) => post(`base-${index}`, 10 + index, 10));
    posts.push(post("viral", 1, 100));

    const alerts = detectCompetitorAlerts(input({ posts }), NOW);

    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "competitor:viral:viral", href: "/concorrentes?c=competitor-1" }),
    ]));
  });

  it("nao detecta viral sem o minimo de 10 posts", () => {
    const posts = Array.from({ length: 8 }, (_, index) => post(`base-${index}`, 10 + index, 10));
    posts.push(post("viral", 1, 100));

    expect(detectCompetitorAlerts(input({ posts }), NOW).some((alert) => alert.key.startsWith("competitor:viral:"))).toBe(false);
  });

  it("detecta salto diario de seguidores acima de 50 e de 3x a media", () => {
    const snapshots = [
      { day: daysAgo(3), followers: 1_000 },
      { day: daysAgo(2), followers: 1_010 },
      { day: daysAgo(1), followers: 1_020 },
      { day: daysAgo(0), followers: 1_080 },
    ];

    const alerts = detectCompetitorAlerts(input({ snapshots }), NOW);

    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "competitor:growth:competitor-1:2026-11-16" }),
    ]));
  });

  it("nao detecta salto abaixo do minimo absoluto de 50", () => {
    const snapshots = [
      { day: daysAgo(3), followers: 1_000 },
      { day: daysAgo(2), followers: 1_005 },
      { day: daysAgo(1), followers: 1_010 },
      { day: daysAgo(0), followers: 1_050 },
    ];

    expect(detectCompetitorAlerts(input({ snapshots }), NOW).some((alert) => alert.key.startsWith("competitor:growth:"))).toBe(false);
  });

  it("detecta tanto aumento quanto reducao de cadencia", () => {
    const baseline = Array.from({ length: 6 }, (_, index) => post(`base-${index}`, 8 + index * 4));
    const increased = [...baseline, post("week-1", 1), post("week-2", 2), post("week-3", 3)];
    const reducedBaseline = Array.from({ length: 10 }, (_, index) => post(`frequent-${index}`, 8 + index * 2));

    expect(detectCompetitorAlerts(input({ posts: increased }), NOW)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "competitor:cadence:competitor-1", title: expect.stringContaining("aumentou") }),
    ]));
    expect(detectCompetitorAlerts(input({ posts: [...reducedBaseline, post("only", 1)] }), NOW)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "competitor:cadence:competitor-1", title: expect.stringContaining("reduziu") }),
    ]));
  });

  it("detecta formato recente apenas quando nao foi usado nos 90 dias anteriores", () => {
    const newFormat = detectCompetitorAlerts(input({ posts: [post("old-image", 20), post("new-reel", 1, 10, "VIDEO", "REELS")] }), NOW);
    const repeatedFormat = detectCompetitorAlerts(input({ posts: [post("old-reel", 20, 10, "VIDEO", "REELS"), post("new-reel", 1, 10, "VIDEO", "REELS")] }), NOW);

    expect(newFormat).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "competitor:format:competitor-1:reels" }),
    ]));
    expect(repeatedFormat.some((alert) => alert.key === "competitor:format:competitor-1:reels")).toBe(false);
  });
});
