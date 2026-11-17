import { describe, expect, it } from "vitest";
import { compareClientWithCompetitors, type ComparisonProfile } from "@/lib/competitor-comparison";

const NOW = new Date("2026-11-16T15:00:00.000Z");

function profile(id: string, isOwn: boolean, options: { followers?: number; captions?: string[]; hours?: number[]; formats?: string[] } = {}): ComparisonProfile {
  const captions = options.captions ?? ["Post"];
  return {
    id,
    username: id,
    isOwn,
    followers: options.followers ?? 1_000,
    posts: captions.map((caption, index) => ({
      id: `${id}-${index}`,
      caption,
      timestamp: new Date(NOW.getTime() - index * 86_400_000 + ((options.hours?.[index] ?? 12) - 12) * 3_600_000),
      mediaType: options.formats?.[index] ?? "IMAGE",
      mediaProductType: options.formats?.[index] === "REELS" ? "REELS" : null,
      likeCount: 90 + index * 10,
      commentsCount: 10,
      permalink: null,
      thumbnailUrl: null,
    })),
    snapshots: [],
  };
}

describe("compareClientWithCompetitors", () => {
  it("exige um perfil marcado como cliente", () => {
    expect(compareClientWithCompetitors([profile("rival", false)], 30)).toBeNull();
  });

  it("calcula a posição do cliente nas três métricas", () => {
    const result = compareClientWithCompetitors([
      profile("cliente", true, { followers: 2_000, captions: ["A", "B"] }),
      profile("rival-a", false, { followers: 500, captions: ["A", "B", "C"] }),
      profile("rival-b", false, { followers: 4_000, captions: ["A"] }),
    ], 30)!;

    expect(result.rankings).toHaveLength(3);
    expect(result.rankings.every((ranking) => ranking.rank >= 1 && ranking.total === 3)).toBe(true);
  });

  it("ignora referências de mercado em rankings e oportunidades", () => {
    const reference = profile("referencia", false, { followers: 100, captions: ["#referencia", "#referencia"] });
    reference.category = "REFERENCE";
    const result = compareClientWithCompetitors([
      profile("cliente", true, { captions: ["Conteúdo próprio"] }),
      profile("direto", false, { captions: ["#direto"] }),
      reference,
    ], 30)!;

    expect(result.competitors.map((item) => item.id)).toEqual(["direto"]);
    expect(result.rankings.every((ranking) => ranking.total === 2)).toBe(true);
    expect(result.opportunities.hashtags.some((item) => item.tag === "#referencia")).toBe(false);
  });

  it("lista hashtag usada por tres concorrentes e ausente no cliente", () => {
    const result = compareClientWithCompetitors([
      profile("cliente", true, { captions: ["Sem hashtag"] }),
      profile("a", false, { captions: ["#oportunidade"] }),
      profile("b", false, { captions: ["#oportunidade"] }),
      profile("c", false, { captions: ["#oportunidade"] }),
    ], 30)!;

    expect(result.opportunities.hashtags).toEqual([
      expect.objectContaining({ tag: "#oportunidade", competitorCount: 3 }),
    ]);
  });

  it("não recomenda hashtag que o cliente já usa", () => {
    const profiles = [profile("cliente", true, { captions: ["#comum"] }), ...["a", "b", "c"].map((id) => profile(id, false, { captions: ["#comum"] }))];
    expect(compareClientWithCompetitors(profiles, 30)!.opportunities.hashtags).toHaveLength(0);
  });

  it("encontra formato com pelo menos 20 pontos de diferença", () => {
    const result = compareClientWithCompetitors([
      profile("cliente", true, { captions: ["A", "B"], formats: ["IMAGE", "IMAGE"] }),
      profile("rival", false, { captions: ["A", "B", "C"], formats: ["REELS", "REELS", "IMAGE"] }),
    ], 30)!;

    expect(result.opportunities.formats).toEqual(expect.arrayContaining([
      expect.objectContaining({ format: "Reels", gap: expect.any(Number) }),
    ]));
  });

  it("encontra faixa de horário usada pelos concorrentes e não pelo cliente", () => {
    const result = compareClientWithCompetitors([
      profile("cliente", true, { hours: [9] }),
      profile("rival", false, { hours: [20] }),
    ], 30)!;

    expect(result.opportunities.timeRanges).toEqual([
      expect.objectContaining({ label: "Noite", start: 18, end: 23 }),
    ]);
  });
});
