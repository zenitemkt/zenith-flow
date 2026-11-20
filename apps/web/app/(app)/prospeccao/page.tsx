import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma, type ProspectStatus, type ProspectTemperature } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { mergeProspectingConfig, type ProspectingConfig } from "@/lib/prospecting/config";
import { MAX_SEARCH_COMBINATIONS } from "@/lib/prospecting/search";
import { sentToday, whatsappOpenerFor } from "@/lib/prospecting/outreach";
import { isMobileBr } from "@/lib/assistant/form-outreach";
import { ProspectingSettingsForm } from "./ProspectingSettingsForm";
import { ProspectSearchButton } from "./ProspectSearchButton";
import { ProspectRowActions } from "./ProspectRowActions";
import { ProspectOutreachForm } from "./ProspectOutreachForm";
import { ProspectEmailSendButton } from "./ProspectEmailSendButton";

export const dynamic = "force-dynamic";

const CARD = "rounded-xl border border-[#E4E7EC] bg-white p-4";
type Tab = "empresas" | "busca" | "contato";
const TABS: { id: Tab; label: string }[] = [
  { id: "empresas", label: "Empresas" },
  { id: "busca", label: "Busca" },
  { id: "contato", label: "Contato" },
];
const FILTERS: Record<string, { label: string; statuses: ProspectStatus[] }> = {
  lista: { label: "Na lista", statuses: ["NOVO", "CONTATADO", "RESPONDEU"] },
  leads: { label: "Viraram lead", statuses: ["VIROU_LEAD"] },
  descartados: { label: "Descartados", statuses: ["DESQUALIFICADO"] },
};
const TEMPS: { id: ProspectTemperature; label: string; className: string }[] = [
  { id: "QUENTE", label: "Quente", className: "bg-[#FEF3F2] text-[#B42318]" },
  { id: "MORNO", label: "Morno", className: "bg-[#FFFAEB] text-[#B54708]" },
  { id: "FRIO", label: "Frio", className: "bg-[#EFF8FF] text-[#175CD3]" },
];
const STATUS_LABEL: Record<ProspectStatus, string> = { NOVO: "Novo", CONTATADO: "Contatado", RESPONDEU: "Respondeu", DESQUALIFICADO: "Descartado", VIROU_LEAD: "Virou lead" };

const dateShort = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

function formatPhone(digits: string | null) {
  if (!digits) return "—";
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digits;
}

export default async function ProspeccaoPage({ searchParams }: { searchParams: { aba?: string; filtro?: string; temp?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  if (isClientRole(membership.role)) redirect("/");
  const agencyId = membership.agencyId;
  const tab: Tab = TABS.find((t) => t.id === searchParams.aba)?.id ?? "empresas";

  const settings = await prisma.prospectingSettings.findUnique({ where: { agencyId } });
  const config = mergeProspectingConfig(settings?.config);
  const pendingRuns = Array.isArray(settings?.pendingRuns) ? settings.pendingRuns.length : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Prospecção automática</h1>
        <p className="text-sm text-[#667085]">Empresas do Google Maps que ainda não conhecem a Zenite. Só viram lead no Comercial quando engajam.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#E4E7EC]">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "empresas" ? "/prospeccao" : `/prospeccao?aba=${t.id}`}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? "border-[#FF2B00] text-[#FF2B00]" : "border-transparent text-[#667085] hover:text-[#344054]"}`}
          >
            {t.label}
            {t.id === "busca" && pendingRuns > 0 && <span className="ml-1.5 rounded-full bg-[#FFF4ED] px-1.5 py-0.5 text-[10px] text-[#C4320A]">buscando</span>}
          </Link>
        ))}
      </div>

      {tab === "empresas" && <EmpresasTab agencyId={agencyId} config={config} filtro={searchParams.filtro} temp={searchParams.temp} pendingRuns={pendingRuns} lastSearchAt={settings?.lastSearchAt ?? null} />}

      {tab === "busca" && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className={CARD}>
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Onde buscar</h2>
            <ProspectingSettingsForm config={config} hasToken={Boolean(settings?.apifyTokenEnc)} maxCombinations={MAX_SEARCH_COMBINATIONS} />
          </section>
          <section className={CARD}>
            <h2 className="mb-1 text-sm font-semibold text-[#101828]">Buscar empresas</h2>
            <p className="mb-3 text-xs text-[#667085]">Cada busca leva alguns minutos no Apify. Empresas repetidas e quem já é lead da Zenite ficam de fora.</p>
            <ProspectSearchButton pending={pendingRuns} ready={Boolean(settings?.apifyTokenEnc) && config.segments.length > 0 && config.cities.length > 0} />
            {settings?.lastSearchError && <p className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">{settings.lastSearchError}</p>}
          </section>
        </div>
      )}

      {tab === "contato" && <ContatoTab agencyId={agencyId} config={config} />}
    </div>
  );
}

async function EmpresasTab({ agencyId, config, filtro, temp: tempParam, pendingRuns, lastSearchAt }: { agencyId: string; config: ProspectingConfig; filtro?: string; temp?: string; pendingRuns: number; lastSearchAt: Date | null }) {
  const filter = filtro && FILTERS[filtro] ? filtro : "lista";
  const temp = TEMPS.find((t) => t.id === tempParam)?.id ?? null;
  const [prospects, byStatus, hot] = await Promise.all([
    prisma.prospect.findMany({
      where: { agencyId, status: { in: FILTERS[filter]!.statuses }, ...(temp ? { temperature: temp } : {}) },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.prospect.groupBy({ by: ["status"], where: { agencyId }, _count: { _all: true } }),
    prisma.prospect.count({ where: { agencyId, temperature: "QUENTE", status: { in: FILTERS.lista!.statuses } } }),
  ]);
  const countOf = (statuses: ProspectStatus[]) => byStatus.filter((g) => statuses.includes(g.status)).reduce((total, g) => total + g._count._all, 0);
  const href = (next: { filtro?: string; temp?: string | null }) => {
    const params = new URLSearchParams();
    const f = next.filtro ?? filter;
    const t = next.temp === undefined ? temp : next.temp;
    if (f !== "lista") params.set("filtro", f);
    if (t) params.set("temp", t);
    const qs = params.toString();
    return `/prospeccao${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Na lista", value: countOf(FILTERS.lista!.statuses) },
          { label: "Quentes na lista", value: hot },
          { label: "Viraram lead", value: countOf(FILTERS.leads!.statuses) },
          { label: "Última busca", value: lastSearchAt ? lastSearchAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—" },
        ].map((stat) => (
          <div key={stat.label} className={CARD}>
            <p className="text-xs text-[#667085]">{stat.label}</p>
            <p className="mt-1 text-xl font-semibold text-[#101828]">{stat.value}</p>
          </div>
        ))}
      </div>

      {pendingRuns > 0 && (
        <p className="rounded-lg bg-[#FFF4ED] px-3 py-2 text-xs text-[#C4320A]">
          Tem uma busca em andamento. <Link href="/prospeccao?aba=busca" className="font-semibold underline">Acompanhe na aba Busca</Link>.
        </p>
      )}

      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {Object.entries(FILTERS).map(([id, f]) => (
              <Link key={id} href={href({ filtro: id })} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === id ? "bg-[#FF2B00] text-white" : "text-[#475467] hover:bg-[#F2F4F7]"}`}>
                {f.label} ({countOf(f.statuses)})
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <Link href={href({ temp: null })} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${!temp ? "bg-[#101828] text-white" : "text-[#475467] hover:bg-[#F2F4F7]"}`}>Todas</Link>
            {TEMPS.map((t) => (
              <Link key={t.id} href={href({ temp: t.id })} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${temp === t.id ? t.className : "text-[#475467] hover:bg-[#F2F4F7]"}`}>{t.label}</Link>
            ))}
          </div>
        </div>

        {prospects.length === 0 ? (
          <p className="rounded-lg bg-[#F9FAFB] px-3 py-6 text-center text-sm text-[#667085]">
            Nenhuma empresa aqui ainda. <Link href="/prospeccao?aba=busca" className="font-semibold text-[#FF2B00] hover:underline">Configure a busca</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs text-[#667085]">
                <tr className="border-b border-[#EAECF0]">
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">Nicho / cidade</th>
                  <th className="py-2 pr-3 font-medium">Telefone</th>
                  <th className="py-2 pr-3 font-medium">Google</th>
                  <th className="py-2 pr-3 font-medium">Site</th>
                  <th className="py-2 pr-3 font-medium">Nota</th>
                  <th className="py-2 pr-3 font-medium">Contato</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => {
                  const t = TEMPS.find((x) => x.id === p.temperature)!;
                  const whatsappUrl = !p.whatsappSentAt && !p.optOut && isMobileBr(p.phone) ? `https://wa.me/${p.phone}?text=${encodeURIComponent(whatsappOpenerFor(config, p))}` : null;
                  const contact = [p.whatsappSentAt ? `WhatsApp ${dateShort(p.whatsappSentAt)}` : null, p.emailStep > 0 ? `E-mail ${p.emailStep}/2` : null, p.optOut ? "Saiu da lista" : null].filter(Boolean);
                  return (
                    <tr key={p.id} className="border-b border-[#F2F4F7] align-top last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-[#101828]">{p.mapsUrl ? <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a> : p.name}</p>
                        <p className="text-[11px] text-[#98A2B3]">{p.potential}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-[#475467]">{p.segment}<br />{p.city}</td>
                      <td className="py-2.5 pr-3 text-xs text-[#344054]">{formatPhone(p.phone)}{p.email && <><br /><span className="text-[#667085]">{p.email}</span></>}</td>
                      <td className="py-2.5 pr-3 text-xs text-[#344054]">{p.rating !== null ? `${p.rating.toLocaleString("pt-BR")} (${p.reviewCount ?? 0})` : "—"}</td>
                      <td className="py-2.5 pr-3 text-xs">{p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-[#175CD3] hover:underline">Tem</a> : <span className="text-[#B42318]">Não tem</span>}</td>
                      <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.className}`}>{p.score.toLocaleString("pt-BR")} · {t.label}</span></td>
                      <td className="py-2.5 pr-3 text-xs text-[#475467]">{contact.length ? contact.join(" · ") : "—"}</td>
                      <td className="py-2.5 pr-3 text-xs text-[#475467]">{STATUS_LABEL[p.status]}</td>
                      <td className="py-2.5"><ProspectRowActions id={p.id} status={p.status} leadId={p.leadId} whatsappUrl={whatsappUrl} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

async function ContatoTab({ agencyId, config }: { agencyId: string; config: ProspectingConfig }) {
  const now = new Date();
  const [dueEmails, today] = await Promise.all([
    prisma.prospect.count({
      where: { agencyId, optOut: false, email: { not: null }, status: { in: ["NOVO", "CONTATADO"] }, OR: [{ emailStep: 0 }, { emailStep: 1, nextEmailAt: { lte: now } }] },
    }),
    sentToday(agencyId, now),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <section className={CARD}>
        <h2 className="mb-3 text-sm font-semibold text-[#101828]">Textos e e-mails</h2>
        <ProspectOutreachForm config={config} />
      </section>
      <section className={`${CARD} flex flex-col gap-4 self-start`}>
        <div>
          <h2 className="mb-1 text-sm font-semibold text-[#101828]">Envios de hoje</h2>
          <p className="text-xs text-[#667085]">
            WhatsApp: {today.whatsapp} de {config.dailyLimits.whatsapp} primeiros contatos · E-mail: {today.email} de {config.dailyLimits.email}
          </p>
        </div>
        <div className="rounded-lg bg-[#F9FAFB] p-3 text-xs text-[#475467]">
          <p className="mb-1 font-semibold text-[#344054]">Como funciona o WhatsApp</p>
          <p>1. Na aba Empresas, clique em WhatsApp: abre a conversa com a mensagem pronta. Envie pelo WhatsApp Business do número da Milena.</p>
          <p>2. Clique em Já enviei. Se a empresa responder, vira lead e a Milena continua a conversa sozinha.</p>
          <p>3. Se não responder em 3 dias, sai um único follow-up automático. Depois disso, mais nada.</p>
        </div>
        <ProspectEmailSendButton due={dueEmails} enabled={config.email.enabled} />
      </section>
    </div>
  );
}
