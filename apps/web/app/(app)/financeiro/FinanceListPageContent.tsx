import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@zenite-mkt/ui";
import { requireSessionAndMembership } from "@/lib/session";
import {
  FINANCE_TYPE_LABELS,
  FINANCE_PERIOD_LABELS,
  FINANCE_PERIODS,
  financePeriodRange,
  type FinancePeriod,
} from "@/lib/finance";
import { DEFAULT_PAGE_SIZE, pageCountFor } from "@/lib/pagination";
import { canManageTeam } from "@/lib/rbac";
import { clientSharesByClient } from "@/lib/finance-partners";
import { scopeTotals } from "@/lib/finance-partner-totals";
import { loadFinanceViewer, parseScope, scopeEntryWhere, scopeOptions } from "@/lib/finance-scope";
import { monthKey, payoutPaymentsOfMonth, summarizePayout } from "@/lib/partner-payouts";
import { prisma, type FinanceEntryType, type Prisma } from "@zenite-mkt/db";
import { NewFinanceEntryModal } from "./NewFinanceEntryModal";
import { FinanceEntryTable } from "./FinanceEntryTable";
import { ManagePartnersButton } from "./ManagePartnersButton";
import { PartnerTotalsTable } from "./PartnerTotalsTable";
import { PayoutTable, type PayoutRow } from "./PayoutTable";
import { ScopePills } from "./ScopePills";
import { partnerChoices, loadPartnerLogins } from "./partner-choices";
import { getHiddenClientIds, visibleByOptionalClientWhere, visibleClientWhere } from "@/lib/client-access";

export async function FinanceListPageContent({
  type,
  page,
  period,
  scope: rawScope,
}: {
  type: FinanceEntryType;
  page: number;
  period: FinancePeriod;
  /** `?scope=`: "" (tudo que vejo), "zenite", "none" ou o id de um sócio (particular dele). */
  scope?: string;
}) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }
  const hidden = await getHiddenClientIds(membership.agencyId, session.user.id);

  const viewer = await loadFinanceViewer(membership.agencyId, session.user.id);
  const scope = parseScope(viewer, rawScope);
  const canManage = canManageTeam(membership.role);

  const dueDateRange = financePeriodRange(period);
  const periodWhere: Prisma.FinanceEntryWhereInput = {
    agencyId: membership.agencyId,
    type,
    ...(dueDateRange ? { dueDate: dueDateRange } : {}),
  };
  // Sempre dentro do que este login pode ver (particular de outro sócio nunca entra).
  const where: Prisma.FinanceEntryWhereInput = { ...periodWhere, AND: [scopeEntryWhere(viewer, scope)] };

  // Fechamento: o repasse só faz sentido olhando um mês fechado em si (este mês ou o passado), nas receitas.
  const closingMonth = type === "RECEITA" && dueDateRange && (period === "this_month" || period === "last_month") ? dueDateRange.gte : null;

  const [total, entries, categories, clients, projects, clientShares, totals, payouts, logins] = await Promise.all([
    prisma.financeEntry.count({ where }),
    prisma.financeEntry.findMany({
      where,
      include: {
        category: { select: { name: true } },
        client: { select: { id: true, name: true } },
        project: { select: { name: true } },
        reversedBy: { select: { id: true } },
        boletoAsset: { select: { id: true, fileName: true } },
        partnerShares: { select: { partnerId: true, amountCents: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.financeCategory.findMany({
      where: { agencyId: membership.agencyId, type },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { AND: [visibleClientWhere(hidden)], agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { AND: [visibleByOptionalClientWhere(hidden)], agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    clientSharesByClient(membership.agencyId),
    viewer.partners.length > 0
      ? scopeTotals(membership.agencyId, viewer, [
          { ...periodWhere, status: { in: ["PREVISTO", "PENDENTE", "VENCIDO"] } },
          { ...periodWhere, status: "LIQUIDADO" },
        ])
      : null,
    closingMonth ? payoutPaymentsOfMonth(membership.agencyId, closingMonth) : null,
    canManage ? loadPartnerLogins(membership.agencyId) : [],
  ]);

  const typeLabel = FINANCE_TYPE_LABELS[type];
  const plural = type === "RECEITA" ? "Contas a receber" : "Contas a pagar";
  const pageCount = pageCountFor(total);
  const basePath = type === "RECEITA" ? "/financeiro/receber" : "/financeiro/pagar";
  const partners = partnerChoices(viewer);
  const scopeLabel = scopeOptions(viewer).find((o) => o.value === scope)?.label;

  function listHref(next: { period?: FinancePeriod; scope?: string; page?: number }) {
    const params = new URLSearchParams();
    const nextPeriod = next.period ?? period;
    const nextScope = next.scope ?? scope;
    if (next.page && next.page > 1) params.set("page", String(next.page));
    if (nextPeriod !== "all") params.set("period", nextPeriod);
    if (nextScope) params.set("scope", nextScope);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  // Fechamento: por sócio, a parte dele nas receitas da Zenite do mês (em aberto + recebido) e o que já foi repassado.
  const payoutRows: PayoutRow[] =
    totals && closingMonth && payouts
      ? totals.rows
          .filter((row) => row.kind === "part")
          .map((row) => {
            const partner = viewer.partners.find((p) => p.id === row.partnerId)!;
            const payments = payouts[partner.id] ?? [];
            const paid = payments.reduce((acc, p) => acc + p.amountCents, 0);
            return { partnerId: partner.id, name: partner.name, summary: summarizePayout(row.cents[0] ?? 0, row.cents[1] ?? 0, paid), payments };
          })
          .filter((row) => row.summary.status !== "nothing")
      : [];
  const closingLabel = closingMonth ? closingMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{plural}</h1>
          <p className="text-sm text-[#667085]">
            {total} {typeLabel.toLowerCase()}
            {total === 1 ? "" : "s"}
            {scope && scopeLabel ? ` — ${scopeLabel}` : ""} em {membership.agency.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ManagePartnersButton partners={partners} canManage={canManage} logins={logins} />
          <NewFinanceEntryModal type={type} categories={categories} clients={clients} projects={projects} partners={partners} clientShares={clientShares} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FINANCE_PERIODS.map((option) => (
            <Link
              key={option}
              href={listHref({ period: option })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                period === option ? "bg-[#FF2B00] text-white" : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
              }`}
            >
              {FINANCE_PERIOD_LABELS[option]}
            </Link>
          ))}
        </div>
        <ScopePills options={scopeOptions(viewer)} active={scope} hrefFor={(value) => listHref({ scope: value })} />
      </div>

      {totals && !scope && (
        <PartnerTotalsTable
          title={`Zenite e sócios — ${FINANCE_PERIOD_LABELS[period].toLowerCase()}`}
          columns={["Em aberto", type === "RECEITA" ? "Recebido" : "Pago"]}
          rows={totals.rows}
          totals={totals.totals}
          footnote={type === "RECEITA" && !closingMonth ? "Para o repasse aos sócios do fechamento, escolha Este mês ou Mês passado." : undefined}
        />
      )}

      {closingMonth && !scope && (
        <PayoutTable month={monthKey(closingMonth)} monthLabel={closingLabel} rows={payoutRows} canManage={canManage} />
      )}

      <FinanceEntryTable entries={entries} showBoleto={type === "RECEITA"} partners={partners} />
      <Pagination page={page} pageCount={pageCount} hrefForPage={(p) => listHref({ page: p })} linkComponent={Link} />
    </div>
  );
}
