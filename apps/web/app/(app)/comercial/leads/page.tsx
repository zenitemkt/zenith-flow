import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@zenite-mkt/ui";
import { requireSessionAndMembership } from "@/lib/session";
import { LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS } from "@/lib/leads";
import { DEFAULT_PAGE_SIZE, pageCountFor, parsePage } from "@/lib/pagination";
import { prisma } from "@zenite-mkt/db";
import { NewLeadModal } from "./NewLeadModal";
import { DeleteLeadRowButton } from "./DeleteLeadRowButton";
import { canManageTeam } from "@/lib/rbac";
import { getLeadCommercialSnapshots } from "@/lib/commercial-intelligence";

export default async function LeadsPage({ searchParams }: { searchParams: { page?: string; signal?: string; source?: string; sort?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const page = parsePage(searchParams.page);
  /**
   * Filtro/ordenação por sinal (score, última atividade) depende de dado
   * calculado, não de uma coluna — por isso não dá pra paginar no SQL e
   * precisamos trazer os leads pra aplicar o filtro em memória. Um teto aqui
   * evita que isso cresça sem limite junto com a base de leads da agência;
   * acima dele, os leads mais antigos ficam de fora desta visão filtrada
   * (mas continuam acessíveis por busca direta/pipeline).
   */
  const LEADS_INTELLIGENCE_LIMIT = 2000;
  const allLeads = await prisma.lead.findMany({
    where: { agencyId: membership.agencyId },
    orderBy: { createdAt: "desc" },
    take: LEADS_INTELLIGENCE_LIMIT,
  });
  const snapshots = await getLeadCommercialSnapshots(membership.agencyId, allLeads.map((lead) => lead.id));
  const sources = Array.from(new Set(allLeads.map((lead) => lead.source).filter((value): value is string => Boolean(value)))).sort();
  const filtered = allLeads.map((lead) => ({ lead, snapshot: snapshots.get(lead.id) })).filter(({ lead, snapshot }) => {
    if (searchParams.source && lead.source !== searchParams.source) return false;
    if (searchParams.signal === "hot" && snapshot?.temperature !== "ALTO") return false;
    if (searchParams.signal === "returning" && (snapshot?.visitsCount ?? 0) < 2) return false;
    if (searchParams.signal === "abandoned" && (!snapshot || snapshot.formStartsCount <= snapshot.formSubmitsCount)) return false;
    if (searchParams.signal === "client-return" && !(lead.convertedClientId && snapshot?.lastActivityAt)) return false;
    return true;
  }).sort((a, b) => searchParams.sort === "score" ? (b.snapshot?.score ?? 0) - (a.snapshot?.score ?? 0) : searchParams.sort === "activity" ? (b.snapshot?.lastActivityAt?.getTime() ?? 0) - (a.snapshot?.lastActivityAt?.getTime() ?? 0) : b.lead.createdAt.getTime() - a.lead.createdAt.getTime());
  const total = filtered.length;
  const pageCount = pageCountFor(total);
  const rows = filtered.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE);
  const canDeleteLeads = canManageTeam(membership.role);

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

      {/* Priorização comercial */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4">
        <select name="signal" defaultValue={searchParams.signal ?? ""} className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm"><option value="">Todos os sinais</option><option value="hot">Leads quentes</option><option value="returning">Retornos recentes</option><option value="abandoned">Formulário abandonado</option><option value="client-return">Cliente com novo interesse</option></select>
        <select name="source" defaultValue={searchParams.source ?? ""} className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm"><option value="">Todas as origens</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select>
        <select name="sort" defaultValue={searchParams.sort ?? "recent"} className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm"><option value="recent">Cadastro mais recente</option><option value="score">Maior interesse</option><option value="activity">Última atividade</option></select>
        <button className="h-10 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white">Aplicar</button>
        <Link href="/comercial/pendencias" className="flex h-10 items-center rounded-lg border border-[#FF2B00] px-4 text-sm font-semibold text-[#FF2B00]">Ver pendências</Link>
      </form>

      {rows.length === 0 ? (
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
                <th className="px-4 py-3">Interesse</th>
                <th className="px-4 py-3">Última atividade</th>
                {canDeleteLeads && (
                  <th className="w-14 px-4 py-3 text-right">
                    <span className="sr-only">Ações</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lead, snapshot }) => (
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
                    {lead.convertedClientId && (
                      <span className="ml-2 rounded-full bg-[#FFF1EC] px-2 py-0.5 text-xs font-semibold text-[#C4320A]">Já é cliente</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${snapshot?.temperature === "ALTO" ? "bg-[#ECFDF3] text-[#027A48]" : snapshot?.temperature === "MEDIO" ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[#F2F4F7] text-[#475467]"}`}>{snapshot?.score ?? 0}/100</span></td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{snapshot?.lastActivityAt ? snapshot.lastActivityAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
                  {canDeleteLeads && (
                    <td className="px-4 py-3 text-right">
                      <DeleteLeadRowButton leadId={lead.id} leadName={lead.name} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Pagination page={page} pageCount={pageCount} hrefForPage={(p) => { const query = new URLSearchParams(); query.set("page", String(p)); if (searchParams.signal) query.set("signal", searchParams.signal); if (searchParams.source) query.set("source", searchParams.source); if (searchParams.sort) query.set("sort", searchParams.sort); return `/comercial/leads?${query.toString()}`; }} linkComponent={Link} />
          </div>
        </div>
      )}
    </div>
  );
}
