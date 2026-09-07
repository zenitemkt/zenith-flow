import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { FINANCE_TYPE_LABELS } from "@/lib/finance";
import { prisma, type FinanceEntryType } from "@zenith/db";
import { NewFinanceEntryModal } from "./NewFinanceEntryModal";
import { FinanceEntryTable } from "./FinanceEntryTable";

export async function FinanceListPageContent({ type }: { type: FinanceEntryType }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [entries, categories, clients, projects] = await Promise.all([
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{plural}</h1>
          <p className="text-sm text-[#667085]">
            {entries.length} {typeLabel.toLowerCase()}
            {entries.length === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <NewFinanceEntryModal type={type} categories={categories} clients={clients} projects={projects} />
      </div>

      <FinanceEntryTable entries={entries} showBoleto={type === "RECEITA"} />
    </div>
  );
}
