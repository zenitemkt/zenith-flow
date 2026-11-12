/**
 * Divisão de um valor entre os sócios (2026-11-12) — regras puras, sem banco,
 * usadas pelos formulários e pela API. Um lançamento ou não tem divisão
 * nenhuma, ou a soma das partes é exatamente o valor dele.
 */
export interface ShareInput {
  partnerId: string;
  amountCents: number;
}

export class ShareError extends Error {}

function toCents(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim().replace(/\./g, "").replace(",", ".")) : Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** "1.500,00" / "1500" / 1500 → centavos; `null` se não for número. */
export function amountInputToCents(value: string | number): number | null {
  if (typeof value === "string" && !value.trim()) return null;
  return toCents(value);
}

/**
 * Lê `shares` do corpo da requisição: `[{ partnerId, amount }]` (reais).
 * - campo ausente → `undefined` (quem chama decide o padrão);
 * - lista vazia → `[]` (sem divisão);
 * - um sócio sem `amount` → fica com `totalCents` inteiro.
 */
export function parseSharesBody(raw: unknown, totalCents: number): ShareInput[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new ShareError("Divisão entre sócios inválida.");
  const shares: ShareInput[] = [];
  for (const item of raw) {
    const partnerId = typeof item?.partnerId === "string" ? item.partnerId : "";
    if (!partnerId) throw new ShareError("Divisão entre sócios inválida.");
    const hasAmount = item.amount !== undefined && item.amount !== null && item.amount !== "";
    const amountCents = hasAmount ? toCents(item.amount) : raw.length === 1 ? totalCents : null;
    if (amountCents === null) throw new ShareError("Informe o valor de cada sócio.");
    shares.push({ partnerId, amountCents });
  }
  return shares;
}

/** `null` se a divisão vale para um lançamento de `totalCents`; senão, a mensagem do erro. */
export function sharesError(shares: ShareInput[], totalCents: number): string | null {
  if (shares.length === 0) return null;
  if (new Set(shares.map((s) => s.partnerId)).size !== shares.length) return "O mesmo sócio aparece duas vezes na divisão.";
  if (shares.some((s) => s.amountCents <= 0)) return "O valor de cada sócio precisa ser maior que zero.";
  const sum = shares.reduce((acc, s) => acc + s.amountCents, 0);
  if (sum !== totalCents) {
    const diff = Math.abs(totalCents - sum) / 100;
    const text = diff.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return sum < totalCents ? `A divisão não fecha: faltam ${text}.` : `A divisão não fecha: passou ${text}.`;
  }
  return null;
}

/**
 * Divide `totalCents` na mesma proporção de `weights` (ex.: padrão do cliente
 * 1000/500 aplicado a um recebimento de 3000 → 2000/1000). Os centavos que
 * sobram do arredondamento vão para quem tem a maior fração; a soma sempre
 * fecha com o total. Total negativo (estorno) devolve partes negativas.
 */
export function splitProportionally(totalCents: number, weights: ShareInput[]): ShareInput[] {
  const valid = weights.filter((w) => w.amountCents > 0);
  const weightSum = valid.reduce((acc, w) => acc + w.amountCents, 0);
  if (valid.length === 0 || weightSum === 0 || totalCents === 0) return [];
  const sign = totalCents < 0 ? -1 : 1;
  const total = Math.abs(totalCents);
  const exact = valid.map((w) => (total * w.amountCents) / weightSum);
  const floors = exact.map(Math.floor);
  let rest = total - floors.reduce((acc, n) => acc + n, 0);
  const order = exact.map((value, index) => ({ index, frac: value - floors[index]! })).sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const { index } of order) {
    if (rest <= 0) break;
    floors[index]! += 1;
    rest -= 1;
  }
  return valid.map((w, index) => ({ partnerId: w.partnerId, amountCents: sign * floors[index]! })).filter((s) => s.amountCents !== 0);
}

/** Estado do campo "De quem é" nos formulários. */
export interface SplitFormValue {
  /** "" = sem divisão · "split" = dividido · senão, o id do sócio único. */
  choice: string;
  /** Valor digitado de cada sócio (modo dividido). */
  amounts: Record<string, string>;
}

export const EMPTY_SPLIT: SplitFormValue = { choice: "", amounts: {} };

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Divisão salva → estado do formulário. */
export function splitValueFromShares(shares: ShareInput[]): SplitFormValue {
  if (shares.length === 0) return EMPTY_SPLIT;
  if (shares.length === 1) return { choice: shares[0]!.partnerId, amounts: {} };
  return { choice: "split", amounts: Object.fromEntries(shares.map((s) => [s.partnerId, centsToInput(Math.abs(s.amountCents))])) };
}

/**
 * Estado do formulário → corpo `shares` da API (`[{ partnerId, amount }]`).
 * Sócio único vai sem valor (o servidor usa o total do lançamento).
 */
export function splitValueToBody(value: SplitFormValue): { partnerId: string; amount?: number }[] {
  if (!value.choice) return [];
  if (value.choice !== "split") return [{ partnerId: value.choice }];
  return Object.entries(value.amounts)
    .map(([partnerId, text]) => ({ partnerId, cents: amountInputToCents(text) }))
    .filter((s) => s.cents !== null && s.cents > 0)
    .map((s) => ({ partnerId: s.partnerId, amount: s.cents! / 100 }));
}

/** Soma (centavos) do que já foi digitado no modo dividido. */
export function splitTypedCents(value: SplitFormValue): number {
  return Object.values(value.amounts).reduce((acc, text) => acc + Math.max(0, amountInputToCents(text) ?? 0), 0);
}
