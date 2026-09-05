import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_BADGE_CLASS, formatProposalValue } from "@/lib/proposals";
import { prisma } from "@zenith/db";
import { NewProposalModal } from "./NewProposalModal";

export default async function ProposalsPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [proposals, clients, leads] = await Promise.all([
    prisma.proposal.findMany({
      where: { agencyId: membership.agencyId },
      include: { client: { select: { name: true } }, lead: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ where: { agencyId: membership.agencyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: { agencyId: membership.agencyId, status: { not: "CONVERTIDO" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Propostas</h1>
          <p className="text-sm text-[#667085]">
            {proposals.length} proposta{proposals.length === 1 ? "" : "s"} em {membership.agency.name} (seção 39 do
            manual).
          </p>
        </div>
        <NewProposalModal clients={clients} leads={leads} />
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma proposta ainda. Crie a primeira.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Proposta</th>
                <th className="px-4 py-3">Vínculo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link href={`/comercial/propostas/${proposal.id}`} className="font-medium text-[#101828] hover:text-[#6847F5]">
                      {proposal.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{proposal.client?.name ?? proposal.lead?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-[#475467]">{formatProposalValue(proposal.valueCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROPOSAL_STATUS_BADGE_CLASS[proposal.status]}`}>
                      {PROPOSAL_STATUS_LABELS[proposal.status]}
                    </span>
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
