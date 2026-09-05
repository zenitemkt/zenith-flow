import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CHURN_BAND_LABELS, CHURN_BAND_BADGE_CLASS } from "@/lib/churn-risk";
import { prisma } from "@zenith/db";

export default async function ChurnRiskPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [clients, snapshots, activePlans] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId: membership.agencyId, status: { in: ["ATIVO", "REATIVADO"] } },
      orderBy: { name: "asc" },
    }),
    prisma.churnRiskSnapshot.findMany({
      where: { agencyId: membership.agencyId },
      orderBy: { createdAt: "desc" },
      select: { clientId: true, score: true, band: true, createdAt: true },
    }),
    prisma.retentionPlan.findMany({
      where: { agencyId: membership.agencyId, status: "ATIVO" },
      select: { clientId: true },
    }),
  ]);

  const latestByClientId = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!latestByClientId.has(snapshot.clientId)) {
      latestByClientId.set(snapshot.clientId, snapshot);
    }
  }
  const activePlanClientIds = new Set(activePlans.map((p) => p.clientId));

  const rows = clients
    .map((client) => ({ client, snapshot: latestByClientId.get(client.id) }))
    .sort((a, b) => (b.snapshot?.score ?? -1) - (a.snapshot?.score ?? -1));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Risco de churn</h1>
        <p className="text-sm text-[#667085]">
          Sinais explicáveis (seção 31 do manual) — clientes ativos e reativados de {membership.agency.name},
          ordenados por score de risco.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum cliente ativo ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Risco</th>
                <th className="px-4 py-3">Calculado em</th>
                <th className="px-4 py-3">Plano de retenção</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, snapshot }) => (
                <tr key={client.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${client.id}`} className="font-medium text-[#101828] hover:text-[#6847F5]">
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{snapshot ? snapshot.score : "—"}</td>
                  <td className="px-4 py-3">
                    {!snapshot ? (
                      <span className="text-xs text-[#98A2B3]">Não calculado</span>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHURN_BAND_BADGE_CLASS[snapshot.band]}`}
                      >
                        {CHURN_BAND_LABELS[snapshot.band]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#98A2B3]">
                    {snapshot ? snapshot.createdAt.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {activePlanClientIds.has(client.id) ? (
                      <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs font-medium text-[#3730A3]">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-xs text-[#98A2B3]">Nenhum</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
