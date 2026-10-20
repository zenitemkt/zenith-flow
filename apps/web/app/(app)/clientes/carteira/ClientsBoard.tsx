"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MessageCircle,
  Music2,
  PencilLine,
  RotateCcw,
  Search,
  Users,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { SOCIAL_NETWORKS, socialChipLabel, type SocialNetworkId } from "@/lib/clients";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { NewClientForm } from "./NewClientForm";

export interface ClientCardData {
  id: string;
  name: string;
  segment: string | null;
  active: boolean;
  initials: string;
  hasAvatar: boolean;
  hasBanner: boolean;
  bannerGradient: string;
  socials: { network: SocialNetworkId; url: string }[];
  counts: { todo: number; doing: number; review: number; done: number };
}

const SOCIAL_ICONS: Record<SocialNetworkId, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  youtube: Youtube,
  linkedin: Linkedin,
  site: Globe,
  whatsapp: MessageCircle,
};

const SOCIAL_LABEL = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, n.label])) as Record<SocialNetworkId, string>;

type Filter = "all" | "active" | "inactive";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function Counter({
  icon,
  value,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-[76px] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-white transition-colors ${
        active ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <span className="flex items-center gap-1.5 text-lg font-bold leading-none">
        {icon}
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{label}</span>
    </button>
  );
}

function CountBadge({ icon: Icon, value, label, tone }: { icon: LucideIcon; value: number; label: string; tone: string }) {
  return (
    <span className="flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-semibold text-[#101828]" title={label} aria-label={`${label}: ${value}`}>
      <Icon size={15} className={value > 0 ? tone : "text-[#98A2B3]"} aria-hidden />
      <span className={value > 0 ? "" : "text-[#98A2B3]"}>{value}</span>
    </span>
  );
}

function ClientCard({ client, canDelete }: { client: ClientCardData; canDelete: boolean }) {
  return (
    <article className="group relative overflow-hidden rounded-[20px] border border-[#EEF0F3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
      <Link href={`/clientes/${client.id}`} className="block" aria-label={`Abrir ${client.name}`}>
        <div
          className="h-[88px] w-full bg-cover bg-center"
          style={client.hasBanner ? { backgroundImage: `url(/api/clients/${client.id}/image/banner)` } : { background: client.bannerGradient }}
        />
      </Link>
      {canDelete && (
        <div className="absolute right-2 top-2 rounded-lg bg-white/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <DeleteRecordButton
            endpoint={`/api/clients/${client.id}`}
            recordName={client.name}
            entityLabel="Cliente"
            warning="Contatos, portal e dados operacionais ou financeiros dependentes serão removidos; propostas e negociações comerciais serão preservadas sem o vínculo."
          />
        </div>
      )}

      <div className="px-4 pb-4">
        <div className="-mt-7 mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-[3px] border-white bg-[#3b3f4a] text-sm font-bold text-white shadow-sm">
          {client.hasAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/clients/${client.id}/image/avatar`} alt="" className="h-full w-full object-cover" />
          ) : (
            client.initials
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <Link href={`/clientes/${client.id}`} className="flex min-w-0 items-center gap-2 font-semibold text-[#101828] hover:underline">
            <span className={`h-2 w-2 shrink-0 rounded-full ${client.active ? "bg-[#16A36A]" : "bg-[#D94343]"}`} aria-hidden />
            <span className="truncate">{client.name}</span>
          </Link>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              client.active ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"
            }`}
          >
            {client.active ? "Ativo" : "Inativo"}
          </span>
        </div>
        <p className="mt-0.5 min-h-[18px] truncate text-xs text-[#667085]">{client.segment ?? "Ramo não informado"}</p>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Redes sociais</p>
        <div className="mt-1.5 flex min-h-[32px] flex-wrap gap-1.5">
          {client.socials.length === 0 ? (
            <span className="text-xs text-[#98A2B3]">Nenhuma cadastrada</span>
          ) : (
            client.socials.map(({ network, url }) => {
              const Icon = SOCIAL_ICONS[network];
              return (
                <a
                  key={network}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={SOCIAL_LABEL[network]}
                  className="flex max-w-full items-center gap-1.5 rounded-full bg-[#F2F4F7] px-3 py-1.5 text-xs font-medium text-[#475467] hover:bg-[#E4E7EC]"
                >
                  <Icon size={13} aria-hidden className="shrink-0" />
                  <span className="truncate">{socialChipLabel(network, url)}</span>
                </a>
              );
            })
          )}
        </div>

        <div className="mt-3 flex divide-x divide-[#E4E7EC] overflow-hidden rounded-xl bg-[#F6F7FA]">
          <CountBadge icon={PencilLine} value={client.counts.todo} label="A fazer" tone="text-[#2563EB]" />
          <CountBadge icon={Clock} value={client.counts.doing} label="Fazendo" tone="text-[#2563EB]" />
          <CountBadge icon={RotateCcw} value={client.counts.review} label="Em revisão" tone="text-[#D94343]" />
          <CountBadge icon={CheckCircle2} value={client.counts.done} label="Feitos" tone="text-[#16A36A]" />
        </div>
      </div>
    </article>
  );
}

export function ClientsBoard({
  clients,
  agencyName,
  canDelete,
}: {
  clients: ClientCardData[];
  agencyName: string;
  canDelete: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const activeCount = clients.filter((c) => c.active).length;
  const inactiveCount = clients.length - activeCount;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return clients.filter((client) => {
      if (filter === "active" && !client.active) return false;
      if (filter === "inactive" && client.active) return false;
      if (!q) return true;
      const haystack = normalize([client.name, client.segment ?? "", ...client.socials.map((s) => socialChipLabel(s.network, s.url))].join(" "));
      return haystack.includes(q);
    });
  }, [clients, query, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-[#0B0B0F] px-6 py-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold !text-white">Todos os clientes</h1>
          <p className="mt-1 text-sm text-white/60">A carteira inteira de {agencyName} num lugar só.</p>
        </div>
        <div className="flex gap-2">
          <Counter icon={<CheckCircle2 size={14} className="text-[#3dd68c]" aria-hidden />} value={activeCount} label="Ativos" active={filter === "active"} onClick={() => setFilter(filter === "active" ? "all" : "active")} />
          <Counter icon={<RotateCcw size={14} className="text-[#ff8a80]" aria-hidden />} value={inactiveCount} label="Inativos" active={filter === "inactive"} onClick={() => setFilter(filter === "inactive" ? "all" : "inactive")} />
          <Counter icon={<Users size={14} className="text-[#93b4ff]" aria-hidden />} value={clients.length} label="Total" active={filter === "all"} onClick={() => setFilter("all")} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3 text-sm text-[#667085]">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, @perfil ou ramo..."
            aria-label="Buscar clientes"
            className="h-full flex-1 !border-0 bg-transparent !shadow-none outline-none"
          />
        </label>
        <NewClientForm />
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum cliente ainda. Crie o primeiro para começar o onboarding.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum cliente encontrado com esse filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((client) => (
            <ClientCard key={client.id} client={client} canDelete={canDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
