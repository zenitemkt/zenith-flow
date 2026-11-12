import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import type { SystemAlertCategory, SystemAlertStatus } from "@prisma/client";
import { requireSessionAndMembership } from "@/lib/session";
import { getCommercialPendencies } from "@/lib/commercial-pendencies";
import { SYSTEM_ALERT_CATEGORY_LABEL } from "@/lib/system-alerts";
import { AlertActions } from "./AlertActions";

const CATEGORIES = Object.keys(SYSTEM_ALERT_CATEGORY_LABEL) as SystemAlertCategory[];
const STATUS_LABEL: Record<SystemAlertStatus, string> = { OPEN: "Abertos", RESOLVED: "Resolvidos", IGNORED: "Ignorados" };
const SEVERITY = {
  CRITICAL: { label: "Crítico", cls: "bg-[#FEF3F2] text-[#B42318] ring-[#FECDCA]" },
  WARNING: { label: "Atenção", cls: "bg-[#FFFAEB] text-[#B54708] ring-[#FEDF89]" },
  INFO: { label: "Aviso", cls: "bg-[#EFF8FF] text-[#175CD3] ring-[#B2DDFF]" },
} as const;

function fmt(d: Date) {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function duration(from: Date, to: Date) {
  const min = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`;
}

export default async function AlertsPage({ searchParams }: { searchParams: { categoria?: string; status?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  const agencyId = membership.agencyId;
  const category = CATEGORIES.includes(searchParams.categoria as SystemAlertCategory) ? (searchParams.categoria as SystemAlertCategory) : undefined;
  const status: SystemAlertStatus = searchParams.status === "RESOLVED" || searchParams.status === "IGNORED" ? searchParams.status : "OPEN";

  const [alerts, counts, commercial] = await Promise.all([
    prisma.systemAlert.findMany({ where: { agencyId, status, ...(category ? { category } : {}) }, orderBy: { lastSeenAt: "desc" }, take: 200 }),
    prisma.systemAlert.groupBy({ by: ["category"], where: { agencyId, status: "OPEN" }, _count: { _all: true } }),
    getCommercialPendencies(agencyId),
  ]);
  const openBy = new Map(counts.map((c) => [c.category, c._count._all]));
  const order = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
  if (status === "OPEN") alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

  const link = (changes: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const next = { categoria: category, status: status === "OPEN" ? undefined : status, ...changes };
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return `/alertas${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Central de alertas</h1>
        <p className="text-sm text-[#667085]">
          Falhas do site, do blog, do traqueamento, das redes sociais, das automações e das integrações. O site é checado todo dia às 7h e às 10h; as demais falhas aparecem na hora em que acontecem e se resolvem sozinhas quando a checagem volta a passar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Link href="/comercial/pendencias" className="rounded-xl border border-[#E4E7EC] bg-white p-3 hover:border-[#FF2B00]">
          <p className="text-xs text-[#667085]">Comercial</p>
          <p className="text-xl font-semibold text-[#101828]">{commercial.summary.total}</p>
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={link({ categoria: category === c ? undefined : c, status: undefined })} className={`rounded-xl border bg-white p-3 hover:border-[#FF2B00] ${category === c ? "border-[#FF2B00]" : "border-[#E4E7EC]"}`}>
            <p className="text-xs text-[#667085]">{SYSTEM_ALERT_CATEGORY_LABEL[c]}</p>
            <p className={`text-xl font-semibold ${openBy.get(c) ? "text-[#B42318]" : "text-[#101828]"}`}>{openBy.get(c) ?? 0}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["OPEN", "RESOLVED", "IGNORED"] as const).map((s) => (
          <Link key={s} href={link({ status: s === "OPEN" ? undefined : s })} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === s ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
            {STATUS_LABEL[s]}
          </Link>
        ))}
        {category && (
          <Link href={link({ categoria: undefined })} className="text-sm font-medium text-[#FF2B00]">
            Limpar categoria ({SYSTEM_ALERT_CATEGORY_LABEL[category]}) ×
          </Link>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        {alerts.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#667085]">{status === "OPEN" ? "Nenhum alerta aberto. Tudo funcionando." : "Nada por aqui."}</p>
        ) : (
          <ul className="divide-y divide-[#EEF0F3]">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ${SEVERITY[a.severity].cls}`}>{SEVERITY[a.severity].label}</span>
                    <span className="font-medium text-[#475467]">{SYSTEM_ALERT_CATEGORY_LABEL[a.category]}</span>
                    <span className="text-[#98A2B3]">
                      desde {fmt(a.firstSeenAt)}
                      {a.occurrences > 1 ? ` · ${a.occurrences} ocorrências` : ""}
                      {a.resolvedAt ? ` · resolvido ${fmt(a.resolvedAt)} (${duration(a.firstSeenAt, a.resolvedAt)}${a.autoResolved ? ", automático" : ""})` : ""}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#101828]">{a.title}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-[#475467]">{a.detail}</p>
                </div>
                <AlertActions id={a.id} status={a.status} href={a.href} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
