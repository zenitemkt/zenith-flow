import { describe, expect, it } from "vitest";
import { mapLeadFields } from "./meta-lead-fields";

describe("Lead Ads — campos do formulário", () => {
  it("separa campos padrão das perguntas personalizadas", () => {
    const out = mapLeadFields([
      { name: "first_name", values: ["Ana"] },
      { name: "last_name", values: ["Souza"] },
      { name: "email", values: ["ana@x.com"] },
      { name: "phone_number", values: ["+5519999990000"] },
      { name: "qual_o_seu_faturamento?", values: ["R$ 10 mil"] },
    ]);
    expect(out).toMatchObject({ name: "Ana Souza", email: "ana@x.com", phone: "+5519999990000" });
    expect(out.extras).toEqual(["qual o seu faturamento?: R$ 10 mil"]);
  });

  it("perguntas personalizadas preenchem os campos do formulário do site", () => {
    const out = mapLeadFields([
      { name: "qual_serviço_você_procura?", values: ["Gestão de tráfego"] },
      { name: "quanto_pretende_investir_por_mês?", values: ["R$ 1.200 a R$ 3.000"] },
    ]);
    expect(out).toMatchObject({ service: "Gestão de tráfego", investment: "R$ 1.200 a R$ 3.000" });
  });
});
