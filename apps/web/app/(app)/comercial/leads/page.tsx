import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@zenith/ui";
import { requireSessionAndMembership } from "@/lib/session";
import { LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS } from "@/lib/leads";
import { DEFAULT_PAGE_SIZE, pageCountFor, parsePage } from "@/lib/pagination";
import { prisma } from "@zenith/db";
import { NewLeadModal } from "./NewLeadModal";

export default async function LeadsPage({ searchParams }: { searchParams: { page?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const page = parsePage(searchParams.page);
  const [total, leads] = await Promise.all([
    prisma.lead.count({ where: { agencyId: membership.agencyId } }),
    prisma.lead.findMany({
      where: { agencyId: membership.agencyId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);
  const pageCount = pageCountFor(total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Leads</h1>
          <p className="text-sm text-[#667085]">
            {total} lead{total === 1 ? "" : "s"} em {membership.agency.name} (seção 39 do manual).
          </p>
        </div>
        <NewLeadModal />
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum lead ainda. Crie o primeiro.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link href={`/comercial/leads/${lead.id}`} className="font-medium text-[#101828] hover:text-[#FF2B00]">
                      {lead.name}
                    </Link>
                    {lead.email && <span className="ml-2 text-xs text-[#98A2B3]">{lead.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{lead.company ?? "—"}</td>
                  <td className="px-4 py-3 text-[#475467]">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEAD_STATUS_BADGE_CLASS[lead.status]}`}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Pagination page={page} pageCount={pageCount} hrefForPage={(p) => `/comercial/leads?page=${p}`} linkComponent={Link} />
          </div>
        </div>
      )}
    </div>
  );
}
