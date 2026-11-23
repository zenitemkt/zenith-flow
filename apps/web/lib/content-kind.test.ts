import { describe, expect, it } from "vitest";
import { CONTENT_STATUS_LABELS } from "./content";
import { canKindUseStatus, contentStatusLabelFor, isDesignKind, nextTaskStatus, parseContentKind } from "./content-kind";

describe("content-kind", () => {
  it("aceita só tipos conhecidos e cai em Design", () => {
    expect(parseContentKind("FINANCEIRO")).toBe("FINANCEIRO");
    expect(parseContentKind("qualquer")).toBe("DESIGN");
    expect(parseContentKind(undefined)).toBe("DESIGN");
  });

  it("Design usa todos os status; tarefa só o fluxo curto", () => {
    expect(isDesignKind("DESIGN")).toBe(true);
    expect(canKindUseStatus("DESIGN", "AGUARDANDO_CLIENTE")).toBe(true);
    expect(canKindUseStatus("ATENDIMENTO", "PRODUCAO")).toBe(true);
    expect(canKindUseStatus("ATENDIMENTO", "PUBLICADO")).toBe(true);
    expect(canKindUseStatus("SITE", "REVISAO_INTERNA")).toBe(false);
    expect(canKindUseStatus("OUTROS", "APROVADO")).toBe(false);
  });

  it("tarefa mostra rótulos de tarefa", () => {
    expect(contentStatusLabelFor("FINANCEIRO", "PUBLICADO", CONTENT_STATUS_LABELS)).toBe("Concluído");
    expect(contentStatusLabelFor("FINANCEIRO", "IDEIA", CONTENT_STATUS_LABELS)).toBe("A fazer");
    expect(contentStatusLabelFor("DESIGN", "PUBLICADO", CONTENT_STATUS_LABELS)).toBe("Publicado");
  });

  it("próximo passo do fluxo curto", () => {
    expect(nextTaskStatus("IDEIA")).toBe("PRODUCAO");
    expect(nextTaskStatus("PRODUCAO")).toBe("PUBLICADO");
    expect(nextTaskStatus("PUBLICADO")).toBe("ARQUIVADO");
  });
});

describe("taskStatusActions", () => {
  it("só oferece status do fluxo curto", async () => {
    const { taskStatusActions } = await import("./content-kind");
    for (const s of ["IDEIA", "PRODUCAO", "PUBLICADO"] as const) {
      for (const o of taskStatusActions(s).options) expect(canKindUseStatus("OUTROS", o)).toBe(true);
    }
    expect(taskStatusActions("PRODUCAO").options[0]).toBe("PUBLICADO");
  });
});
