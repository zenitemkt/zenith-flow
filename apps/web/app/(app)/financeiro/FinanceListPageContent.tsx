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
import { prisma, type FinanceEntryType } from "@zenite-mkt/db";
import { NewFinanceEntryModal } from "./NewFinanceEntryModal";
import { FinanceEntryTable } from "./FinanceEntryTable";

export async function FinanceListPageContent({
  type,
  page,
  period,
}: {
  type: FinanceEntryType;
  page: number;
  period: FinancePeriod;
}) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const dueDateRange = financePeriodRange(period);
  const where = {
    agencyId: membership.agencyId,
    type,
    ...(dueDateRange ? { dueDate: dueDateRange } : {}),
  };

  const [total, entries, categories, clients, projects] = await Promise.all([
    prisma.financeEntry.count({ where }),
    prisma.financeEntry.findMany({
      where,
      include: {
        category: { select: { name: true } },
        client: { select: { id: true, name: true } },
        project: { select: { name: true } },
        reversedBy: { select: { id: true } },
        boletoAsset: { select: { id: true, fileName: true } },
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
  ]);

  const typeLabel = FINANCE_TYPE_LABELS[type];
  const plural = type === "RECEITA" ? "Contas a receber" : "Contas a pagar";
  const pageCount = pageCountFor(total);
  const basePath = type === "RECEITA" ? "/financeiro/receber" : "/financeiro/pagar";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{plural}</h1>
          <p className="text-sm text-[#667085]">
            {total} {typeLabel.toLowerCase()}
            {total === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <NewFinanceEntryModal type={type} categories={categories} clients={clients} projects={projects} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FINANCE_PERIODS.map((option) => (
          <Link
            key={option}
            href={option === "all" ? basePath : `${basePath}?period=${option}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              period === option
                ? "bg-[#FF2B00] text-white"
                : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
            }`}
          >
            {FINANCE_PERIOD_LABELS[option]}
          </Link>
        ))}
      </div>

      <FinanceEntryTable entries={entries} showBoleto={type === "RECEITA"} />
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) => `${basePath}?page=${p}${period !== "all" ? `&period=${period}` : ""}`}
        linkComponent={Link}
      />
    </div>
  );
}
