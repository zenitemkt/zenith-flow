import { describe, expect, it, vi } from "vitest";

vi.mock("@zenite-mkt/db", () => ({ prisma: {} }));

const { buildFinanceViewer, canSeeEntry, entryScopeOf, parseScope, scopeEntryWhere, scopeOptions, visibleEntryWhere, businessEntryWhereFor, SCOPE_ZENITE, SCOPE_NONE } =
  await import("./finance-scope");

const partners = [
  { id: "pk", name: "Kevin", active: true, userId: "u-kevin" },
  { id: "pg", name: "Gabriel", active: true, userId: "u-gabriel" },
];
const kevin = buildFinanceViewer("u-kevin", partners);
const gabriel = buildFinanceViewer("u-gabriel", partners);
const funcionario = buildFinanceViewer("u-outro", partners);
const semVinculo = buildFinanceViewer("u-kevin", partners.map((p) => ({ ...p, userId: null })));

const soKevin = [{ partnerId: "pk" }];
const soGabriel = [{ partnerId: "pg" }];
const dividido = [{ partnerId: "pk" }, { partnerId: "pg" }];

describe("Zenite × particular — classificação", () => {
  it("dividido é Zenite em qualquer proporção; um sócio só é particular; sem parte é não definido", () => {
    expect(entryScopeOf(dividido).kind).toBe("zenite");
    expect(entryScopeOf(soKevin)).toEqual({ kind: "particular", partnerId: "pk" });
    expect(entryScopeOf([]).kind).toBe("none");
  });
});

describe("Zenite × particular — quem vê o quê", () => {
  it("cada sócio vê a Zenite, o não definido e o próprio particular — nunca o do outro", () => {
    expect(canSeeEntry(kevin, dividido)).toBe(true);
    expect(canSeeEntry(kevin, [])).toBe(true);
    expect(canSeeEntry(kevin, soKevin)).toBe(true);
    expect(canSeeEntry(kevin, soGabriel)).toBe(false);
    expect(canSeeEntry(gabriel, soGabriel)).toBe(true);
    expect(canSeeEntry(gabriel, soKevin)).toBe(false);
  });

  it("quem não é sócio só vê a Zenite e o não definido", () => {
    expect(canSeeEntry(funcionario, dividido)).toBe(true);
    expect(canSeeEntry(funcionario, soKevin)).toBe(false);
    expect(canSeeEntry(funcionario, soGabriel)).toBe(false);
  });

  it("sócio sem login ligado não esconde nada (ninguém mais poderia ver)", () => {
    expect(canSeeEntry(semVinculo, soGabriel)).toBe(true);
    expect(visibleEntryWhere(semVinculo)).toEqual({});
  });

  it("o filtro do banco esconde exatamente o particular dos outros", () => {
    expect(visibleEntryWhere(kevin)).toEqual({ NOT: [{ partnerShares: { some: { partnerId: "pg" }, every: { partnerId: "pg" } } }] });
  });

  it("os números do negócio excluem o particular de todos, igual para qualquer login", () => {
    expect(businessEntryWhereFor(["pk", "pg"])).toEqual({
      NOT: [
        { partnerShares: { some: { partnerId: "pk" }, every: { partnerId: "pk" } } },
        { partnerShares: { some: { partnerId: "pg" }, every: { partnerId: "pg" } } },
      ],
    });
    expect(businessEntryWhereFor([])).toEqual({});
  });
});

describe("Zenite × particular — recortes da tela", () => {
  it("Kevin escolhe entre Tudo, Zenite, Kevin e Não definido — Gabriel não aparece", () => {
    expect(scopeOptions(kevin).map((o) => o.label)).toEqual(["Tudo", "Zenite", "Kevin", "Não definido"]);
    expect(scopeOptions(gabriel).map((o) => o.label)).toEqual(["Tudo", "Zenite", "Gabriel", "Não definido"]);
    expect(scopeOptions(funcionario).map((o) => o.label)).toEqual(["Tudo", "Zenite", "Não definido"]);
  });

  it("forçar na URL o recorte do outro sócio cai em 'tudo que vejo'", () => {
    expect(parseScope(kevin, "pg")).toBe("");
    expect(parseScope(kevin, "pk")).toBe("pk");
    expect(parseScope(kevin, SCOPE_ZENITE)).toBe(SCOPE_ZENITE);
    expect(scopeEntryWhere(kevin, "pg")).toEqual(visibleEntryWhere(kevin));
  });

  it("recorte Zenite pede divisão e exclui particular; não definido pede nenhuma parte", () => {
    expect(scopeEntryWhere(kevin, SCOPE_ZENITE)).toEqual({
      AND: [{ partnerShares: { some: {} } }, businessEntryWhereFor(["pk", "pg"])],
    });
    expect(scopeEntryWhere(kevin, SCOPE_NONE)).toEqual({ partnerShares: { none: {} } });
  });
});
