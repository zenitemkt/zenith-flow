import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";
import { LEAD_STATUS_LABELS } from "@/lib/leads";
import {
  ALL_CLIENT_STATUSES,
  ALL_LEAD_STATUSES,
  parseMarketingFilters,
  fetchMarketingRows,
} from "@/lib/marketing-audience";
import { prisma } from "@zenite-mkt/db";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function getAll(searchParams: PageProps["searchParams"], key: string): string[] {
  const value = searchParams[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const PREVIEW_LIMIT = 50;

export default async function MarketingPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const hasAnyParam = Object.keys(searchParams).length > 0;
  const filters = parseMarketingFilters((key) => getAll(searchParams, key), hasAnyParam);

  const [rows, stages] = await Promise.all([
    fetchMarketingRows(membership.agencyId, filters),
    prisma.pipelineStage.findMany({ where: { agencyId: membership.agencyId }, orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Marketing</h1>
        <p className="text-sm text-[#667085]">
          Todo mundo com quem a agência já se relacionou — clientes, ex-clientes e leads. Filtre e exporte em CSV pra
          disparar e-mail marketing, mala direta ou WhatsApp por outra ferramenta.
        </p>
      </div>

      <form method="get" className="flex flex-col gap-5 rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-[#101828]">Clientes</legend>
            {ALL_CLIENT_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm text-[#344054]">
                <input
                  type="checkbox"
                  name="clientStatus"
                  value={status}
                  defaultChecked={filters.clientStatuses.includes(status)}
                  className="h-4 w-4 rounded border-[#D0D5DD]"
                />
                {CLIENT_STATUS_LABELS[status]}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-[#101828]">Leads</legend>
            {ALL_LEAD_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm text-[#344054]">
                <input
                  type="checkbox"
                  name="leadStatus"
                  value={status}
                  defaultChecked={filters.leadStatuses.includes(status)}
                  className="h-4 w-4 rounded border-[#D0D5DD]"
                />
                {LEAD_STATUS_LABELS[status]}
              </label>
            ))}
            <p className="text-xs text-[#98A2B3]">
              Convertido não aparece aqui — quem virou cliente já é listado do lado de Clientes, sem duplicar.
            </p>
          </fieldset>
        </div>

        {stages.length > 0 && (
          <fieldset className="flex flex-col gap-2 border-t border-[#EEF0F3] pt-4">
            <legend className="mb-1 text-sm font-semibold text-[#101828]">Etapa do pipeline (opcional)</legend>
            <p className="text-xs text-[#98A2B3]">
              Marque uma ou mais pra restringir o resultado só a quem tem uma oportunidade aberta nessa etapa — deixe
              tudo desmarcado pra não filtrar por etapa.
            </p>
            <div className="flex flex-wrap gap-3">
              {stages.map((stage) => (
                <label key={stage.id} className="flex items-center gap-2 text-sm text-[#344054]">
                  <input
                    type="checkbox"
                    name="stageId"
                    value={stage.id}
                    defaultChecked={filters.stageIds.includes(stage.id)}
                    className="h-4 w-4 rounded border-[#D0D5DD]"
                  />
                  {stage.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-[#EEF0F3] pt-4">
          <button
            type="submit"
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-4 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
          >
            Aplicar filtro
          </button>
          <button
            type="submit"
            formAction="/api/clients/marketing-export"
            className="flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: "#FF2B00" }}
          >
            Exportar CSV
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="border-b border-[#EEF0F3] px-4 py-3 text-sm text-[#667085]">
          {rows.length} contato{rows.length === 1 ? "" : "s"} encontrado{rows.length === 1 ? "" : "s"} com esse filtro.
        </div>
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#667085]">Nenhum contato com esse filtro.</p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Telefone/WhatsApp</th>
                  <th className="px-4 py-3">E-mail</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map((row, index) => (
                  <tr key={index} className="border-t border-[#EEF0F3]">
                    <td className="px-4 py-3 font-medium text-[#101828]">{row.name}</td>
                    <td className="px-4 py-3 text-[#475467]">{row.company ?? "—"}</td>
                    <td className="px-4 py-3 text-[#475467]">{row.type}</td>
                    <td className="px-4 py-3 text-[#475467]">{row.status}</td>
                    <td className="px-4 py-3 text-[#475467]">{row.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-[#475467]">{row.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > PREVIEW_LIMIT && (
              <p className="border-t border-[#EEF0F3] px-4 py-3 text-xs text-[#98A2B3]">
                Mostrando os {PREVIEW_LIMIT} primeiros de {rows.length} — exporte o CSV pra ver todos.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
