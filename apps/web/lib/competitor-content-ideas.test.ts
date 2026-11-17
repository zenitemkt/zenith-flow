import { describe, expect, it } from "vitest";
import { parseCompetitorContentIdeas } from "./competitor-content-ideas";

const idea = (index: number) => ({ title: `Ideia ${index}`, format: "Reels", hook: `Gancho ${index}`, captionOpening: `Legenda ${index}`, rationale: `Razão ${index}`, sources: ["@fonte"] });

describe("sugestões de pauta dos concorrentes", () => {
  it("aceita JSON puro ou cercado por bloco markdown", () => {
    const body = JSON.stringify({ ideas: Array.from({ length: 10 }, (_, index) => idea(index + 1)) });
    expect(parseCompetitorContentIdeas(body)).toHaveLength(10);
    expect(parseCompetitorContentIdeas(`\`\`\`json\n${body}\n\`\`\``)[0]?.title).toBe("Ideia 1");
  });

  it("recusa respostas incompletas", () => {
    expect(() => parseCompetitorContentIdeas(JSON.stringify({ ideas: [idea(1)] }))).toThrow(/em vez de 10/);
  });
});
