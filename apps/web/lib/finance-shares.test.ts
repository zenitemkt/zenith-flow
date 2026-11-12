import { describe, expect, it } from "vitest";
import {
  ShareError,
  amountInputToCents,
  parseSharesBody,
  sharesError,
  splitProportionally,
  splitValueFromShares,
  splitValueToBody,
} from "./finance-shares";

const K = "kevin";
const G = "gabriel";

describe("divisão entre sócios — leitura do formulário", () => {
  it("entende valores em reais digitados", () => {
    expect(amountInputToCents("1500")).toBe(150000);
    expect(amountInputToCents("1.500,50")).toBe(150050);
    expect(amountInputToCents("")).toBeNull();
    expect(amountInputToCents("abc")).toBeNull();
  });

  it("campo ausente não decide nada; lista vazia é sem divisão", () => {
    expect(parseSharesBody(undefined, 1000)).toBeUndefined();
    expect(parseSharesBody([], 1000)).toEqual([]);
  });

  it("um sócio só fica com o valor inteiro", () => {
    expect(parseSharesBody([{ partnerId: K }], 100000)).toEqual([{ partnerId: K, amountCents: 100000 }]);
  });

  it("dividido exige o valor de cada um", () => {
    expect(parseSharesBody([{ partnerId: K, amount: 500 }, { partnerId: G, amount: 1000 }], 150000)).toEqual([
      { partnerId: K, amountCents: 50000 },
      { partnerId: G, amountCents: 100000 },
    ]);
    expect(() => parseSharesBody([{ partnerId: K, amount: 500 }, { partnerId: G }], 150000)).toThrow(ShareError);
  });
});

describe("divisão entre sócios — validação", () => {
  it("1500 = 1000 do Gabriel + 500 do Kevin", () => {
    expect(sharesError([{ partnerId: G, amountCents: 100000 }, { partnerId: K, amountCents: 50000 }], 150000)).toBeNull();
  });

  it("avisa quanto falta ou quanto passou", () => {
    expect(sharesError([{ partnerId: G, amountCents: 60000 }, { partnerId: K, amountCents: 30000 }], 100000)).toMatch(/faltam/);
    expect(sharesError([{ partnerId: G, amountCents: 60000 }, { partnerId: K, amountCents: 50000 }], 100000)).toMatch(/passou/);
  });

  it("recusa sócio repetido e parte zerada", () => {
    expect(sharesError([{ partnerId: K, amountCents: 500 }, { partnerId: K, amountCents: 500 }], 1000)).toMatch(/duas vezes/);
    expect(sharesError([{ partnerId: K, amountCents: 1000 }, { partnerId: G, amountCents: 0 }], 1000)).toMatch(/maior que zero/);
  });

  it("sem divisão é sempre válido", () => {
    expect(sharesError([], 1000)).toBeNull();
  });
});

describe("divisão entre sócios — proporção do cliente", () => {
  const padrao = [
    { partnerId: G, amountCents: 100000 },
    { partnerId: K, amountCents: 50000 },
  ];

  it("aplica a mesma proporção a outro valor", () => {
    expect(splitProportionally(300000, padrao)).toEqual([
      { partnerId: G, amountCents: 200000 },
      { partnerId: K, amountCents: 100000 },
    ]);
  });

  it("a soma sempre fecha, mesmo com centavos quebrados", () => {
    const parts = splitProportionally(100000, [
      { partnerId: "a", amountCents: 1 },
      { partnerId: "b", amountCents: 1 },
      { partnerId: "c", amountCents: 1 },
    ]);
    expect(parts.reduce((acc, p) => acc + p.amountCents, 0)).toBe(100000);
    expect(parts.map((p) => p.amountCents)).toEqual([33334, 33333, 33333]);
  });

  it("cliente de um sócio só: tudo para ele", () => {
    expect(splitProportionally(123456, [{ partnerId: K, amountCents: 1 }])).toEqual([{ partnerId: K, amountCents: 123456 }]);
  });

  it("estorno devolve as partes negativas", () => {
    expect(splitProportionally(-150000, padrao)).toEqual([
      { partnerId: G, amountCents: -100000 },
      { partnerId: K, amountCents: -50000 },
    ]);
  });

  it("sem padrão, sem divisão", () => {
    expect(splitProportionally(1000, [])).toEqual([]);
  });
});

describe("divisão entre sócios — estado do formulário", () => {
  it("vai e volta sem perder nada", () => {
    expect(splitValueToBody(splitValueFromShares([]))).toEqual([]);
    expect(splitValueToBody(splitValueFromShares([{ partnerId: K, amountCents: 1000 }]))).toEqual([{ partnerId: K }]);
    expect(splitValueToBody(splitValueFromShares([{ partnerId: G, amountCents: 60000 }, { partnerId: K, amountCents: 40000 }]))).toEqual([
      { partnerId: G, amount: 600 },
      { partnerId: K, amount: 400 },
    ]);
  });
});
