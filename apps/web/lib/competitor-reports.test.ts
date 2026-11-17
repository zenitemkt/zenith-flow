import { describe, expect, it } from "vitest";
import { monthFromKey, monthKey, parseMonthlyCompetitorReport, previousClosedMonth } from "./competitor-reports";

const valid = {
  title: "Outubro em perspectiva",
  summary: "Resumo factual.",
  marketChanges: ["Mudança"],
  competitorWins: [{ title: "Tema", evidence: "@perfil publicou 4 vezes", implication: "Vale testar" }],
  clientPosition: { strengths: ["Força"], gaps: ["Lacuna"] },
  actions: Array.from({ length: 5 }, (_, index) => ({ title: `Ação ${index + 1}`, why: "Motivo", execution: "Execução", metric: "Métrica" })),
  limitations: ["Sem alcance"],
  sources: { profiles: 3, competitorPosts: 10, clientPosts: 4, ads: 2 },
};

describe("relatórios mensais de concorrentes", () => {
  it("normaliza a chave do mês", () => expect(monthKey(monthFromKey("2026-10"))).toBe("2026-10"));
  it("usa o mês encerrado no horário de Brasília", () => expect(monthKey(previousClosedMonth(new Date("2026-11-01T02:30:00Z")))).toBe("2026-09"));
  it("vira o mês em Brasília à meia-noite", () => expect(monthKey(previousClosedMonth(new Date("2026-11-01T03:00:00Z")))).toBe("2026-10"));
  it("aceita conteúdo completo", () => expect(parseMonthlyCompetitorReport(JSON.stringify(valid)).actions).toHaveLength(5));
  it("rejeita relatório sem cinco ações", () => expect(() => parseMonthlyCompetitorReport({ ...valid, actions: valid.actions.slice(0, 4) })).toThrow(/cinco ações/i));
});
