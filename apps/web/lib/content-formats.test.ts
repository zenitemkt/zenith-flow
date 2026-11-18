import { describe, expect, it } from "vitest";
import { artSizes, channelsAndFormatsLabel, contentChannels, contentFormats, parseChannels, parseFormats } from "./content-formats";

describe("peça com várias redes e formatos", () => {
  it("lista as pranchetas com o tamanho de cada rede e formato", () => {
    expect(artSizes(["INSTAGRAM", "LINKEDIN"], ["Post estático", "Stories"])).toEqual([
      { channel: "INSTAGRAM", format: "Post estático", size: "1080×1350" },
      { channel: "INSTAGRAM", format: "Stories", size: "1080×1920" },
      { channel: "LINKEDIN", format: "Post estático", size: "1080×1080" },
    ]);
  });

  it("deixa de fora combinações que não existem e marca as sem tamanho padrão", () => {
    expect(artSizes(["TIKTOK"], ["Post estático", "Reels"])).toEqual([{ channel: "TIKTOK", format: "Reels", size: "1080×1920" }]);
    expect(artSizes(["YOUTUBE"], ["Vídeo", "Reels"])).toEqual([
      { channel: "YOUTUBE", format: "Vídeo", size: "1280×720" },
      { channel: "YOUTUBE", format: "Reels", size: "1080×1920" },
    ]);
    expect(artSizes(["OUTRO"], ["Stories"])).toEqual([{ channel: "OUTRO", format: "Stories", size: null }]);
    expect(artSizes(["INSTAGRAM"], ["Outro"])).toEqual([{ channel: "INSTAGRAM", format: "Outro", size: null }]);
  });

  it("cartão antigo (listas vazias) usa o canal e o formato únicos", () => {
    const old = { channel: "FACEBOOK", channels: [], format: "Reels", formats: [] };
    expect(contentChannels(old)).toEqual(["FACEBOOK"]);
    expect(contentFormats(old)).toEqual(["Reels"]);
    expect(channelsAndFormatsLabel(old)).toBe("Facebook · Reels");
    expect(channelsAndFormatsLabel({ channel: "INSTAGRAM", channels: [], format: null, formats: [] })).toBe("Instagram");
  });

  it("monta o rótulo com várias redes e formatos", () => {
    expect(channelsAndFormatsLabel({ channel: "INSTAGRAM", channels: ["INSTAGRAM", "LINKEDIN"], format: "Post estático", formats: ["Post estático", "Stories"] })).toBe(
      "Instagram + LinkedIn · Post estático + Stories",
    );
  });

  it("limpa o que vem da API", () => {
    expect(parseChannels(["INSTAGRAM", "X", "INSTAGRAM", 3])).toEqual(["INSTAGRAM"]);
    expect(parseChannels("INSTAGRAM")).toEqual([]);
    expect(parseFormats([" Stories ", "", "Stories", null])).toEqual(["Stories"]);
  });
});
