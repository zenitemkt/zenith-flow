import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@zenite-mkt/ui";
import { requireSessionAndMembership } from "@/lib/session";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";
import { HEALTH_BAND_BADGE_CLASS, bandForScore } from "@/lib/health-score";
import { DEFAULT_PAGE_SIZE, pageCountFor, parsePage } from "@/lib/pagination";
import { prisma } from "@zenite-mkt/db";
import { NewClientForm } from "./NewClientForm";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { canManageTeam } from "@/lib/rbac";

const STATUS_BADGE_CLASS: Record<string, string> = {
  PROSPECT: "bg-[#EEF2FF] text-[#3730A3]",
  ONBOARDING: "bg-[#FEF3C7] text-[#92600A]",
  ATIVO: "bg-[#DCFCE7] text-[#166534]",
  PAUSADO: "bg-[#FEF3C7] text-[#92600A]",
  EM_ENCERRAMENTO: "bg-[#FEE4E2] text-[#B42318]",
  ENCERRADO: "bg-[#F2F4F7] text-[#475467]",
  REATIVADO: "bg-[#EEF2FF] text-[#3730A3]",
};

export default async function CarteiraPage({ searchParams }: { searchParams: { page?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const page = parsePage(searchParams.page);

  const [total, clients] = await Promise.all([
    prisma.client.count({ where: { agencyId: membership.agencyId } }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);
  const pageCount = pageCountFor(total);
  const canDelete = canManageTeam(membership.role);

  const healthSnapshots = await prisma.healthScoreSnapshot.findMany({
    where: { agencyId: membership.agencyId, clientId: { in: clients.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
    select: { clientId: true, score: true },
  });

  const latestScoreByClientId = new Map<string, number>();
  for (const snapshot of healthSnapshots) {
    if (!latestScoreByClientId.has(snapshot.clientId)) {
      latestScoreByClientId.set(snapshot.clientId, snapshot.score);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Carteira de clientes</h1>
          <p className="text-sm text-[#667085]">
            {total} cliente{total === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <NewClientForm />
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhum cliente ainda. Crie o primeiro para começar o onboarding.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Contato principal</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Status</th>
                {canDelete && <th className="w-14 px-4 py-3"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const score = latestScoreByClientId.get(client.id);
                return (
                  <tr key={client.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/clientes/${client.id}`}
                        className="font-medium text-[#101828] hover:text-[#FF2B00]"
                      >
                        {client.name}
                      </Link>
                      {client.document && (
                        <span className="ml-2 text-xs text-[#98A2B3]">{client.document}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#475467]">
                      {client.contacts[0]?.name ?? <span className="text-[#98A2B3]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {score === undefined ? (
                        <span className="text-xs text-[#98A2B3]">Não calculado</span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_BAND_BADGE_CLASS[bandForScore(score)]}`}
                        >
                          {score}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[client.status]}`}
                      >
                        {CLIENT_STATUS_LABELS[client.status]}
                      </span>
                    </td>
                    {canDelete && <td className="px-4 py-3 text-right"><DeleteRecordButton endpoint={`/api/clients/${client.id}`} recordName={client.name} entityLabel="Cliente" warning="Contatos, portal e dados operacionais ou financeiros dependentes serão removidos; propostas e negociações comerciais serão preservadas sem o vínculo." /></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              hrefForPage={(p) => `/clientes/carteira?page=${p}`}
              linkComponent={Link}
            />
          </div>
        </div>
      )}
    </div>
  );
}
