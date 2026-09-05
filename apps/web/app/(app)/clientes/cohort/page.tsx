import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { buildCohortRows, startOfMonthUTC, COHORT_MONTH_WINDOW } from "@/lib/cohort";
import { prisma } from "@zenith/db";

function retentionCellClass(value: number | null): string {
  if (value === null) return "text-[#D0D5DD]";
  if (value >= 80) return "text-[#166534]";
  if (value >= 50) return "text-[#92600A]";
  return "text-[#B42318]";
}

export default async function CohortPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const clients = await prisma.client.findMany({
    where: { agencyId: membership.agencyId },
    include: { statusHistory: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true } } },
  });

  const activatedClients = clients
    .map((client) => {
      const firstActivation = client.statusHistory.find((h) => h.toStatus === "ATIVO");
      if (!firstActivation) return null;
      return {
        clientId: client.id,
        cohortMonthStart: startOfMonthUTC(firstActivation.createdAt),
        statusEvents: client.statusHistory,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const revenueEntries = await prisma.financeEntry.findMany({
    where: {
      agencyId: membership.agencyId,
      type: "RECEITA",
      status: "LIQUIDADO",
      clientId: { in: activatedClients.map((c) => c.clientId) },
      settledDate: { not: null },
    },
    select: { clientId: true, settledDate: true, amountCents: true },
  });

  const revenue = revenueEntries
    .filter((e): e is typeof e & { clientId: string; settledDate: Date } => e.clientId !== null && e.settledDate !== null)
    .map((e) => ({ clientId: e.clientId, monthStart: startOfMonthUTC(e.settledDate), amountCents: e.amountCents }));

  const rows = buildCohortRows(activatedClients, revenue, new Date());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Cohort</h1>
        <p className="text-sm text-[#667085]">
          Clientes agrupados pelo mês em que ativaram, acompanhando retenção de logo e de receita ao longo de{" "}
          {COHORT_MONTH_WINDOW} meses (seção 32.2 do manual).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum cliente ativado ainda para formar um cohort.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Cohort</th>
                <th className="px-4 py-3">Clientes</th>
                {Array.from({ length: COHORT_MONTH_WINDOW }, (_, i) => (
                  <th key={i} className="px-4 py-3">
                    Mês {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cohortMonth} className="border-t border-[#EEF0F3]">
                  <td className="px-4 py-3 font-medium capitalize text-[#101828]">{row.cohortLabel}</td>
                  <td className="px-4 py-3 text-[#475467]">{row.clientCount}</td>
                  {row.logoRetention.map((logo, i) => (
                    <td key={i} className="px-4 py-3">
                      {logo === null ? (
                        <span className="text-[#D0D5DD]">—</span>
                      ) : (
                        <div className="flex flex-col">
                          <span className={`font-semibold ${retentionCellClass(logo)}`}>{logo}%</span>
                          <span className="text-xs text-[#98A2B3]">
                            receita:{" "}
                            {row.revenueRetention[i] === null ? "—" : `${row.revenueRetention[i]}%`}
                          </span>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-[#101828]">Como ler</h2>
        <p className="text-xs text-[#667085]">
          <strong>Logo retention</strong> (número maior): % de clientes daquele cohort que ainda não foram
          encerrados até aquele mês. <strong>Revenue retention</strong> (linha "receita"): receita liquidada
          naquele mês comparada à receita do mês 0 do mesmo cohort — pode passar de 100% se houver expansão.
        </p>
        <p className="mt-2 text-xs text-[#98A2B3]">
          Agrupamento por canal, produto ou squad (também citados na seção 32.2) ainda não está disponível —
          sem dado de canal/produto no sistema hoje; ver docs/DECISIONS.md.
        </p>
      </section>
    </div>
  );
}
