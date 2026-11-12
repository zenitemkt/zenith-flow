import { prisma, type Prisma } from "@zenite-mkt/db";

export interface PartnerTotalRow {
  /** `null` = lançamentos sem divisão definida. */
  partnerId: string | null;
  name: string;
  /** Um valor por coluna pedida, na mesma ordem. */
  cents: number[];
}

/**
 * Soma por sócio de vários recortes de lançamentos (uma coluna por `where`).
 * A linha "Não definido" é o que não tem divisão; a soma das linhas de cada
 * coluna é sempre o total dos lançamentos daquele recorte.
 */
export async function partnerTotals(
  agencyId: string,
  columns: Prisma.FinanceEntryWhereInput[],
): Promise<{ rows: PartnerTotalRow[]; totals: number[] }> {
  const [partners, perColumn] = await Promise.all([
    prisma.financePartner.findMany({ where: { agencyId }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    Promise.all(
      columns.map(async (where) => {
        const scoped = { ...where, agencyId };
        const [byPartner, total] = await Promise.all([
          prisma.financeEntryShare.groupBy({ by: ["partnerId"], where: { financeEntry: scoped }, _sum: { amountCents: true } }),
          prisma.financeEntry.aggregate({ where: scoped, _sum: { amountCents: true } }),
        ]);
        return { byPartner: new Map(byPartner.map((g) => [g.partnerId, g._sum.amountCents ?? 0])), total: total._sum.amountCents ?? 0 };
      }),
    ),
  ]);

  const rows: PartnerTotalRow[] = partners
    .map((p) => ({ partnerId: p.id as string | null, name: p.name, active: p.active, cents: perColumn.map((c) => c.byPartner.get(p.id) ?? 0) }))
    // Sócio desativado só aparece se ainda tiver valor em alguma coluna.
    .filter((row) => row.active || row.cents.some((c) => c !== 0))
    .map(({ partnerId, name, cents }) => ({ partnerId, name, cents }));

  const totals = perColumn.map((c) => c.total);
  const undefinedCents = perColumn.map((c) => c.total - [...c.byPartner.values()].reduce((acc, n) => acc + n, 0));
  if (undefinedCents.some((c) => c !== 0)) rows.push({ partnerId: null, name: "Não definido", cents: undefinedCents });
  return { rows, totals };
}
