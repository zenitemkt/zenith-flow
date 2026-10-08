import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma, type CommercialAlertStatus, type CommercialAlertType } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { syncCommercialAlerts } from "@/lib/commercial-intelligence";
import { AlertActions } from "./AlertActions";

const TYPE_LABELS: Record<CommercialAlertType, string> = {
  HOT_LEAD: "Lead quente",
  RETURNING_LEAD: "Retorno ao site",
  FORM_ABANDONED: "Formulário abandonado",
  CLIENT_RETURNED: "Cliente retornou",
  RETURNED_AFTER_PROPOSAL: "Retorno após proposta",
};

export default async function CommercialAlertsPage({ searchParams }: { searchParams: { status?: string; type?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  await syncCommercialAlerts(membership.agencyId);
  const status: CommercialAlertStatus = searchParams.status === "RESOLVED" || searchParams.status === "IGNORED" ? searchParams.status : "OPEN";
  const type = Object.keys(TYPE_LABELS).includes(searchParams.type ?? "") ? searchParams.type as CommercialAlertType : undefined;
  const alerts = await prisma.commercialAlert.findMany({
    where: { agencyId: membership.agencyId, status, ...(type ? { type } : {}) },
    include: { lead: { select: { id: true, name: true, company: true } } },
    orderBy: { detectedAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Alertas comerciais</h1>
        <p className="text-sm text-[#667085]">Sinais que merecem ação da equipe, sem repetir o mesmo acontecimento.</p>
      </div>
      <form className="flex flex-wrap gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4">
        <select name="status" defaultValue={status} className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm">
          <option value="OPEN">Abertos</option><option value="RESOLVED">Resolvidos</option><option value="IGNORED">Ignorados</option>
        </select>
        <select name="type" defaultValue={type ?? ""} className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="h-10 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center text-sm text-[#667085]">Nenhum alerta nesta visão.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <article key={alert.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#FFF1EC] px-2 py-0.5 text-xs font-semibold text-[#C4320A]">{TYPE_LABELS[alert.type]}</span>
                    {alert.score !== null && <span className="text-xs font-semibold text-[#027A48]">Score {alert.score}/100</span>}
                  </div>
                  <h2 className="mt-2 text-sm font-semibold text-[#101828]">{alert.title}</h2>
                  <p className="mt-1 text-sm text-[#667085]">{alert.detail}</p>
                  <p className="mt-2 text-xs text-[#98A2B3]">{alert.detectedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link href={`/comercial/leads/${alert.lead.id}`} className="text-sm font-semibold text-[#FF2B00] hover:underline">{alert.lead.name}</Link>
                  {alert.lead.company && <span className="text-xs text-[#98A2B3]">{alert.lead.company}</span>}
                  {status === "OPEN" && <AlertActions alertId={alert.id} />}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
