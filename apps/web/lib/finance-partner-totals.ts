import { prisma, type Prisma } from "@zenite-mkt/db";
import { entryScopeOf, visibleEntryWhere, type FinanceViewer } from "@/lib/finance-scope";

export interface ScopeTotalRow {
  /** `zenite` (total dividido), `part:<id>` (parte do sócio na Zenite), `particular:<id>`, `none`. */
  key: string;
  kind: "zenite" | "part" | "particular" | "none";
  partnerId?: string;
  label: string;
  /** Um valor por coluna pedida, na mesma ordem. */
  cents: number[];
}

interface EntryForTotals {
  amountCents: number;
  partnerShares: { partnerId: string; amountCents: number }[];
}

/**
 * Regra pura do quadro "Zenite e sócios": soma cada coluna em
 * Zenite (lançamentos divididos) → parte de cada sócio dentro dela →
 * particular de cada sócio → não definido. `entriesByColumn` já vem só com o
 * que o login pode ver. Zenite + particulares + não definido = total.
 */
export function buildScopeTotals(viewer: FinanceViewer, entriesByColumn: EntryForTotals[][]): { rows: ScopeTotalRow[]; totals: number[] } {
  const n = entriesByColumn.length;
  const zero = () => Array.from({ length: n }, () => 0);
  const zenite = zero();
  const none = zero();
  const totals = zero();
  const parts = new Map<string, number[]>();
  const particular = new Map<string, number[]>();
  const bucket = (map: Map<string, number[]>, id: string) => map.get(id) ?? (map.set(id, zero()), map.get(id)!);

  entriesByColumn.forEach((entries, col) => {
    for (const entry of entries) {
      totals[col]! += entry.amountCents;
      const scope = entryScopeOf(entry.partnerShares);
      if (scope.kind === "none") none[col]! += entry.amountCents;
      else if (scope.kind === "particular") bucket(particular, scope.partnerId!)[col]! += entry.amountCents;
      else {
        zenite[col]! += entry.amountCents;
        for (const share of entry.partnerShares) bucket(parts, share.partnerId)[col]! += share.amountCents;
      }
    }
  });

  const nonZero = (cents: number[] | undefined) => Boolean(cents?.some((c) => c !== 0));
  const rows: ScopeTotalRow[] = [{ key: "zenite", kind: "zenite", label: "Zenite (dividido entre os sócios)", cents: zenite }];
  for (const p of viewer.partners) {
    if (p.active || nonZero(parts.get(p.id))) {
      rows.push({ key: `part:${p.id}`, kind: "part", partnerId: p.id, label: `Parte de ${p.name}`, cents: parts.get(p.id) ?? zero() });
    }
  }
  for (const p of viewer.partners) {
    if (viewer.hiddenPartnerIds.includes(p.id)) continue;
    if ((p.active && p.id === viewer.myPartnerId) || nonZero(particular.get(p.id)) || (p.active && !p.userId)) {
      rows.push({ key: `particular:${p.id}`, kind: "particular", partnerId: p.id, label: `${p.name} (particular)`, cents: particular.get(p.id) ?? zero() });
    }
  }
  if (nonZero(none)) rows.push({ key: "none", kind: "none", label: "Não definido", cents: none });
  return { rows, totals };
}

/** Quadro "Zenite e sócios" para vários recortes de lançamentos (uma coluna por `where`), só com o que o login vê. */
export async function scopeTotals(agencyId: string, viewer: FinanceViewer, columns: Prisma.FinanceEntryWhereInput[]) {
  const entriesByColumn = await Promise.all(
    columns.map((where) =>
      prisma.financeEntry.findMany({
        where: { AND: [where, visibleEntryWhere(viewer)], agencyId },
        select: { amountCents: true, partnerShares: { select: { partnerId: true, amountCents: true } } },
      }),
    ),
  );
  return buildScopeTotals(viewer, entriesByColumn);
}
