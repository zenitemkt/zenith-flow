import { describe, expect, it } from "vitest";
import { analyzeCompetitor, classifyHook, type AnalyticsPost } from "@/lib/competitor-analytics";

function post(id: string, caption: string, engagement: number): AnalyticsPost {
  return {
    id,
    caption,
    timestamp: new Date(`2026-11-${String(10 + Number(id)).padStart(2, "0")}T15:00:00.000Z`),
    mediaType: "IMAGE",
    mediaProductType: null,
    likeCount: engagement,
    commentsCount: 0,
    permalink: null,
    thumbnailUrl: null,
  };
}

describe("classifyHook", () => {
  it.each([
    ["Você sabe por que seu anúncio não vende?", "Pergunta"],
    ["5 motivos para investir em conteúdo", "Número"],
    ["Aprenda como aumentar suas vendas", "Promessa"],
    ["Pare de cometer este erro", "Erro ou alerta"],
    ["Resultado de uma cliente em 30 dias", "Prova social"],
    ["Oferta especial para esta semana", "Oferta"],
    ["Últimas vagas com desconto", "Oferta"],
    ["Bastidores do nosso escritório", "Outro"],
  ])("classifica %s como %s", (caption, expected) => {
    expect(classifyHook(caption)).toBe(expected);
  });
});

describe("temas e desempenho dos ganchos", () => {
  const result = analyzeCompetitor([
    post("1", "Como melhorar seu marketing\nVeja as dicas", 100),
    post("2", "3 erros de marketing que custam caro", 300),
    post("3", "Marketing para empresas locais", 200),
    post("4", "Bastidores da equipe", 20),
  ], 2_000, 30);

  it("agrupa primeira linha por palavra recorrente", () => {
    expect(result.themes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Marketing", count: 3, avgEngagement: 200 }),
    ]));
  });

  it("ordena ganchos pela média de interações", () => {
    expect(result.hooks[0]).toEqual(expect.objectContaining({ name: "Número", avgEngagement: 300 }));
    expect(result.hooks.find((hook) => hook.name === "Promessa")).toEqual(expect.objectContaining({ count: 1, avgEngagement: 100 }));
  });
});
