import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Clock3, Eye, Sparkles } from "lucide-react";
import { requireSessionAndMembership } from "@/lib/session";
import { getCommercialPendencies, type CommercialPendingItem, type CommercialPendingPriority } from "@/lib/commercial-pendencies";

const SECTIONS: { priority: CommercialPendingPriority; title: string; subtitle: string }[] = [
  { priority: "URGENT", title: "Urgente", subtitle: "Itens vencidos ou leads parados há mais de 24 horas." },
  { priority: "TODAY", title: "Hoje", subtitle: "Pendências financeiras que precisam de acompanhamento." },
  { priority: "FOLLOW_UP", title: "Acompanhamento", subtitle: "Propostas e oportunidades aguardando o próximo passo." },
  { priority: "NEW", title: "Novos", subtitle: "Leads recebidos nas últimas 24 horas." },
];

const ICONS = { URGENT: AlertCircle, TODAY: Clock3, FOLLOW_UP: Eye, NEW: Sparkles };
const TONES = { URGENT: "border-[#FDA29B] bg-[#FFFBFA] text-[#B42318]", TODAY: "border-[#FEC84B] bg-[#FFFCF5] text-[#B54708]", FOLLOW_UP: "border-[#B2CCFF] bg-[#F5F8FF] text-[#175CD3]", NEW: "border-[#ABEFC6] bg-[#F6FEF9] text-[#067647]" };

function PendingCard({ item }: { item: CommercialPendingItem }) {
  return (
    <Link href={item.href} className="flex items-start justify-between gap-4 border-t border-[#EEF0F3] px-4 py-3 transition-colors first:border-t-0 hover:bg-[#F9FAFB]">
      <div><p className="text-sm font-semibold text-[#101828]">{item.title}</p><p className="mt-1 text-xs text-[#667085]">{item.detail}</p></div>
      <span className="shrink-0 text-xs font-semibold text-[#FF2B00]">Abrir →</span>
    </Link>
  );
}

export default async function CommercialPendenciesPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  const pendencies = await getCommercialPendencies(membership.agencyId);
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-lg font-semibold text-[#101828]">Pendências comerciais</h1><p className="text-sm text-[#667085]">O que precisa da atenção dos sócios agora, calculado automaticamente pelo andamento comercial.</p></div>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[[pendencies.summary.unattendedLeads, "leads sem atendimento"], [pendencies.summary.newLeads, "leads novos"], [pendencies.summary.proposalsAwaiting, "propostas e acompanhamentos"], [pendencies.summary.pendingPayments, "pagamentos pendentes"]].map(([value, label]) => <div key={label} className="rounded-xl border border-[#E4E7EC] bg-white p-4"><p className="text-2xl font-semibold text-[#101828]">{value}</p><p className="mt-1 text-xs text-[#667085]">{label}</p></div>)}
      </section>
      {pendencies.items.length === 0 ? <div className="rounded-xl border border-dashed border-[#ABEFC6] bg-[#F6FEF9] p-10 text-center"><p className="font-semibold text-[#067647]">Tudo em dia</p><p className="mt-1 text-sm text-[#667085]">Nenhuma pendência comercial precisa de atenção agora.</p></div> : SECTIONS.map((section) => {
        const items = pendencies.items.filter((item) => item.priority === section.priority);
        if (items.length === 0) return null;
        const Icon = ICONS[section.priority];
        return <section key={section.priority} className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white"><div className="flex items-center gap-3 p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${TONES[section.priority]}`}><Icon size={18} /></span><div><h2 className="text-sm font-semibold text-[#101828]">{section.title} · {items.length}</h2><p className="text-xs text-[#667085]">{section.subtitle}</p></div></div><div>{items.map((item) => <PendingCard key={item.id} item={item} />)}</div></section>;
      })}
    </div>
  );
}
