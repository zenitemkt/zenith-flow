import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@zenith/ui";
import { requireSessionAndMembership } from "@/lib/session";
import { FINANCE_TYPE_LABELS } from "@/lib/finance";
import { DEFAULT_PAGE_SIZE, pageCountFor } from "@/lib/pagination";
import { prisma, type FinanceEntryType } from "@zenith/db";
import { NewFinanceEntryModal } from "./NewFinanceEntryModal";
import { FinanceEntryTable } from "./FinanceEntryTable";

export async function FinanceListPageContent({ type, page }: { type: FinanceEntryType; page: number }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [total, entries, categories, clients, projects] = await Promise.all([
    prisma.financeEntry.count({ where: { agencyId: membership.agencyId, type } }),
    prisma.financeEntry.findMany({
      where: { agencyId: membership.agencyId, type },
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

      <FinanceEntryTable entries={entries} showBoleto={type === "RECEITA"} />
      <Pagination page={page} pageCount={pageCount} hrefForPage={(p) => `${basePath}?page=${p}`} linkComponent={Link} />
    </div>
  );
}
