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
import { clientSharesByClient, listFinancePartners } from "@/lib/finance-partners";
import { partnerTotals } from "@/lib/finance-partner-totals";
import { prisma, type FinanceEntryType, type Prisma } from "@zenite-mkt/db";
import { NewFinanceEntryModal } from "./NewFinanceEntryModal";
import { FinanceEntryTable } from "./FinanceEntryTable";
import { ManagePartnersButton } from "./ManagePartnersButton";
import { PartnerTotalsTable } from "./PartnerTotalsTable";

/** `?partner=` da lista: id de um sócio, "none" (sem divisão) ou vazio (todos). */
export const PARTNER_FILTER_NONE = "none";

export async function FinanceListPageContent({
  type,
  page,
  period,
  partner,
}: {
  type: FinanceEntryType;
  page: number;
  period: FinancePeriod;
  partner?: string;
}) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const partners = await listFinancePartners(membership.agencyId);
  const activePartner = partners.find((p) => p.id === partner);
  const partnerFilter = activePartner ? activePartner.id : partner === PARTNER_FILTER_NONE ? PARTNER_FILTER_NONE : "";

  const dueDateRange = financePeriodRange(period);
  const periodWhere: Prisma.FinanceEntryWhereInput = {
    agencyId: membership.agencyId,
    type,
    ...(dueDateRange ? { dueDate: dueDateRange } : {}),
  };
  const where: Prisma.FinanceEntryWhereInput = {
    ...periodWhere,
    ...(partnerFilter === PARTNER_FILTER_NONE
      ? { partnerShares: { none: {} } }
      : partnerFilter
        ? { partnerShares: { some: { partnerId: partnerFilter } } }
        : {}),
  };

  const [total, entries, categories, clients, projects, clientShares, totals] = await Promise.all([
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
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    clientSharesByClient(membership.agencyId),
    partners.length > 0
      ? partnerTotals(membership.agencyId, [
          { ...periodWhere, status: { in: ["PREVISTO", "PENDENTE", "VENCIDO"] } },
          { ...periodWhere, status: "LIQUIDADO" },
        ])
      : null,
  ]);

  const typeLabel = FINANCE_TYPE_LABELS[type];
  const plural = type === "RECEITA" ? "Contas a receber" : "Contas a pagar";
  const pageCount = pageCountFor(total);
  const basePath = type === "RECEITA" ? "/financeiro/receber" : "/financeiro/pagar";

  function listHref(next: { period?: FinancePeriod; partner?: string; page?: number }) {
    const params = new URLSearchParams();
    const nextPeriod = next.period ?? period;
    const nextPartner = next.partner ?? partnerFilter;
    if (next.page && next.page > 1) params.set("page", String(next.page));
    if (nextPeriod !== "all") params.set("period", nextPeriod);
    if (nextPartner) params.set("partner", nextPartner);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ${
      on ? "bg-[#FF2B00] text-white" : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{plural}</h1>
          <p className="text-sm text-[#667085]">
            {total} {typeLabel.toLowerCase()}
            {total === 1 ? "" : "s"}
            {activePartner ? ` de ${activePartner.name}` : partnerFilter === PARTNER_FILTER_NONE ? " sem sócio definido" : ""} em {membership.agency.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ManagePartnersButton partners={partners} canManage={canManageTeam(membership.role)} />
          <NewFinanceEntryModal type={type} categories={categories} clients={clients} projects={projects} partners={partners} clientShares={clientShares} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FINANCE_PERIODS.map((option) => (
            <Link key={option} href={listHref({ period: option })} className={pill(period === option)}>
              {FINANCE_PERIOD_LABELS[option]}
            </Link>
          ))}
        </div>
        {partners.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[#667085]">Sócio</span>
            <Link href={listHref({ partner: "" })} className={pill(!partnerFilter)}>
              Todos
            </Link>
            {partners
              .filter((p) => p.active || p.id === partnerFilter)
              .map((p) => (
                <Link key={p.id} href={listHref({ partner: p.id })} className={pill(partnerFilter === p.id)}>
                  {p.name}
                </Link>
              ))}
            <Link href={listHref({ partner: PARTNER_FILTER_NONE })} className={pill(partnerFilter === PARTNER_FILTER_NONE)}>
              Não definido
            </Link>
          </div>
        )}
      </div>

      {totals && (
        <PartnerTotalsTable
          title={`Por sócio — ${FINANCE_PERIOD_LABELS[period].toLowerCase()}`}
          columns={["Em aberto", type === "RECEITA" ? "Recebido" : "Pago"]}
          rows={totals.rows}
          totals={totals.totals}
        />
      )}

      <FinanceEntryTable entries={entries} showBoleto={type === "RECEITA"} partners={partners} highlightPartnerId={activePartner?.id} />
      <Pagination page={page} pageCount={pageCount} hrefForPage={(p) => listHref({ page: p })} linkComponent={Link} />
    </div>
  );
}
