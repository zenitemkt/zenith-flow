import { describe, expect, it, vi } from "vitest";

vi.mock("@zenite-mkt/db", () => ({ prisma: {} }));

const { computeHiddenClientIds, isClientHidden, visibleByClientWhere, visibleByOptionalClientWhere, visibleClientWhere } = await import("./client-access");
const { buildFinanceViewer, canSeeEntry, scopeEntryWhere, visibleEntryWhere } = await import("./finance-scope");

const partners = [
  { id: "pk", userId: "u-kevin" },
  { id: "pg", userId: "u-gabriel" },
  { id: "ps", userId: null }, // sócio sem login
];
const shares = [
  { clientId: "c-kevin", partnerId: "pk" },
  { clientId: "c-gabriel", partnerId: "pg" },
  { clientId: "c-zenite", partnerId: "pk" },
  { clientId: "c-zenite", partnerId: "pg" },
  { clientId: "c-sem-login", partnerId: "ps" },
  // c-indefinido: sem divisão
];

describe("Cliente particular de um sócio — quem vê", () => {
  it("cada sócio deixa de ver só o cliente particular do outro", () => {
    expect(computeHiddenClientIds("u-kevin", shares, partners)).toEqual(["c-gabriel"]);
    expect(computeHiddenClientIds("u-gabriel", shares, partners)).toEqual(["c-kevin"]);
  });

  it("quem não é sócio não vê os particulares; Zenite, sem definição e sócio sem login ficam para todos", () => {
    expect(computeHiddenClientIds("u-designer", shares, partners)).toEqual(["c-gabriel", "c-kevin"]);
  });

  it("sem sócios ligados a login, ninguém perde nada", () => {
    expect(computeHiddenClientIds("u-kevin", shares, partners.map((p) => ({ ...p, userId: null })))).toEqual([]);
  });
});

describe("Cliente particular — filtros", () => {
  it("lista vazia não acrescenta filtro", () => {
    expect(visibleClientWhere([])).toEqual({});
    expect(visibleByClientWhere([])).toEqual({});
    expect(visibleByOptionalClientWhere([])).toEqual({});
  });

  it("cliente opcional mantém os registros sem cliente", () => {
    expect(visibleByOptionalClientWhere(["c-kevin"])).toEqual({ OR: [{ clientId: null }, { clientId: { notIn: ["c-kevin"] } }] });
    expect(visibleClientWhere(["c-kevin"])).toEqual({ id: { notIn: ["c-kevin"] } });
    expect(isClientHidden(["c-kevin"], "c-kevin")).toBe(true);
    expect(isClientHidden(["c-kevin"], null)).toBe(false);
  });

  it("financeiro: lançamento de cliente oculto some até quando é dividido", () => {
    const gabriel = buildFinanceViewer("u-gabriel", [], ["c-kevin"]);
    expect(canSeeEntry(gabriel, [{ partnerId: "pk" }, { partnerId: "pg" }], "c-kevin")).toBe(false);
    expect(canSeeEntry(gabriel, [], "c-zenite")).toBe(true);
    expect(canSeeEntry(gabriel, [], null)).toBe(true);
    expect(JSON.stringify(visibleEntryWhere(gabriel))).toContain("c-kevin");
    expect(JSON.stringify(scopeEntryWhere(gabriel, "zenite"))).toContain("c-kevin");
    expect(JSON.stringify(scopeEntryWhere(gabriel, "none"))).toContain("c-kevin");
  });
});
