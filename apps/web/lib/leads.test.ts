import { describe, expect, it } from "vitest";
import { parseSiteLeadDetails } from "./leads";

describe("parseSiteLeadDetails", () => {
  it("organiza somente os campos enviados pelo formulário", () => {
    expect(parseSiteLeadDetails("Cidade: Americana\nInteresse: servico\nServiço: Tráfego pago")).toEqual({
      Cidade: "Americana",
      Interesse: "servico",
      Serviço: "Tráfego pago",
    });
  });

  it("não transforma uma nota comum em dados do formulário", () => {
    expect(parseSiteLeadDetails("Cliente pediu retorno amanhã.")).toBeNull();
  });
});