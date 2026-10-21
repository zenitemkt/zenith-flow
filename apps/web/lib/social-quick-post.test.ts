import { describe, expect, it } from "vitest";
import { quickPostMediaError, quickPostTitle, spDateOf } from "./social-quick-post";

describe("publicação direta — título do cartão", () => {
  it("usa o título digitado", () => {
    expect(quickPostTitle({ title: " Lançamento ", caption: "x", platforms: ["INSTAGRAM"], date: "2026-10-25" })).toBe("Lançamento");
  });

  it("sem título, usa a primeira linha da legenda (cortada)", () => {
    expect(quickPostTitle({ title: "", caption: "\nPromo de outubro\n#zenite", platforms: ["INSTAGRAM"], date: "2026-10-25" })).toBe(
      "Promo de outubro",
    );
    const long = "a".repeat(80);
    expect(quickPostTitle({ title: "", caption: long, platforms: ["INSTAGRAM"], date: "2026-10-25" })).toHaveLength(60);
  });

  it("sem título nem legenda, usa redes + dia", () => {
    expect(quickPostTitle({ title: "", caption: "", platforms: ["INSTAGRAM", "FACEBOOK"], date: "2026-10-25" })).toBe(
      "Instagram + Facebook · 25/10",
    );
  });
});

describe("publicação direta — regras da arte", () => {
  const img = { type: "image/jpeg" };
  const vid = { type: "video/mp4" };

  it("Instagram exige arquivo; Facebook só com texto passa", () => {
    expect(quickPostMediaError({ platforms: ["INSTAGRAM"], format: "FEED", files: [] })).toMatch(/Instagram/);
    expect(quickPostMediaError({ platforms: ["FACEBOOK"], format: "FEED", files: [] })).toBeNull();
  });

  it("Reels precisa de um vídeo; Story de um arquivo", () => {
    expect(quickPostMediaError({ platforms: ["INSTAGRAM"], format: "REEL", files: [img] })).toMatch(/Reels/);
    expect(quickPostMediaError({ platforms: ["INSTAGRAM"], format: "REEL", files: [vid] })).toBeNull();
    expect(quickPostMediaError({ platforms: ["INSTAGRAM"], format: "STORY", files: [img, img] })).toMatch(/Story/);
  });

  it("Facebook não aceita Story nem carrossel com vídeo", () => {
    expect(quickPostMediaError({ platforms: ["FACEBOOK"], format: "STORY", files: [img] })).toMatch(/Facebook/);
    expect(quickPostMediaError({ platforms: ["FACEBOOK"], format: "FEED", files: [img, vid] })).toMatch(/carrossel/);
  });
});

describe("publicação direta — dia em São Paulo", () => {
  it("23h30 de Brasília ainda é o mesmo dia", () => {
    expect(spDateOf(new Date("2026-10-26T02:30:00.000Z"))).toBe("2026-10-25");
  });
});
