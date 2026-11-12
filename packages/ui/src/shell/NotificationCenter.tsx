"use client";

import { useState, type ElementType } from "react";
import { Bell, Bot, Globe, Plug, Share2, Briefcase } from "lucide-react";

export type CommercialPriority = "URGENT" | "TODAY" | "FOLLOW_UP" | "NEW";
export type SystemCategory = "SITE" | "TRACKING" | "BLOG" | "SOCIAL" | "AUTOMATION" | "INTEGRATION";
export type SystemSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface AppNotifications {
  count: number;
  items: { id: string; title: string; detail: string; href: string; priority: CommercialPriority }[];
  system?: {
    count: number;
    critical: number;
    items: { id: string; title: string; detail: string; href: string; category: SystemCategory; severity: SystemSeverity; lastSeenAt: string; occurrences: number }[];
  };
}

type TabId = "all" | "commercial" | "site" | "social" | "automation" | "integration";
const TABS: { id: TabId; label: string; icon: ElementType; categories?: SystemCategory[] }[] = [
  { id: "all", label: "Todos", icon: Bell },
  { id: "commercial", label: "Comercial", icon: Briefcase },
  { id: "site", label: "Site", icon: Globe, categories: ["SITE", "TRACKING", "BLOG"] },
  { id: "social", label: "Redes", icon: Share2, categories: ["SOCIAL"] },
  { id: "automation", label: "Automações", icon: Bot, categories: ["AUTOMATION"] },
  { id: "integration", label: "Integrações", icon: Plug, categories: ["INTEGRATION"] },
];
const CATEGORY_LABEL: Record<SystemCategory, string> = { SITE: "Site", TRACKING: "Traqueamento", BLOG: "Blog", SOCIAL: "Redes sociais", AUTOMATION: "Automações", INTEGRATION: "Integrações" };
const PRIORITY_DOT: Record<CommercialPriority, string> = { URGENT: "bg-[#D92D20]", TODAY: "bg-[#F79009]", FOLLOW_UP: "bg-[#2E90FA]", NEW: "bg-[#12B76A]" };
const SEVERITY_DOT: Record<SystemSeverity, string> = { CRITICAL: "bg-[#D92D20]", WARNING: "bg-[#F79009]", INFO: "bg-[#2E90FA]" };

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} dias`;
}

/** Sino do cabeçalho: alertas comerciais + alertas de sistema por categoria. */
export function NotificationCenter({ notifications, linkComponent }: { notifications?: AppNotifications; linkComponent: ElementType }) {
  const Link = linkComponent;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("all");
  const system = notifications?.system;
  const commercialCount = notifications?.count ?? 0;
  const total = commercialCount + (system?.count ?? 0);
  const hasCritical = (system?.critical ?? 0) > 0 || (notifications?.items ?? []).some((i) => i.priority === "URGENT");
  const badgeColor = hasCritical ? "bg-[#D92D20]" : (system?.count ?? 0) > 0 ? "bg-[#F79009]" : "bg-[#FF2B00]";

  const countFor = (t: (typeof TABS)[number]) =>
    t.id === "all" ? total : t.id === "commercial" ? commercialCount : (system?.items ?? []).filter((i) => t.categories!.includes(i.category)).length;
  const current = TABS.find((t) => t.id === tab)!;
  const systemItems = (system?.items ?? []).filter((i) => tab === "all" || (current.categories ?? []).includes(i.category));
  const commercialItems = tab === "all" || tab === "commercial" ? notifications?.items ?? [] : [];
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#FF2B00]/25 dark:border-[#303343] dark:bg-[#171821] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"
        aria-label={total ? `Alertas: ${total} pendentes` : "Alertas"}
        aria-expanded={open}
      >
        <Bell size={17} aria-hidden />
        {total > 0 && (
          <span className={`absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full ${badgeColor} px-1 text-[10px] font-bold leading-none text-white`}>{total > 99 ? "99+" : total}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[420px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl dark:border-[#303343] dark:bg-[#171821]">
          <div className="flex items-center justify-between border-b border-[#EEF0F3] px-4 py-3 dark:border-[#303343]">
            <div>
              <p className="text-sm font-semibold text-[#101828] dark:text-white">Central de alertas</p>
              <p className="text-xs text-[#667085] dark:text-[#AEB4C5]">
                {total ? `${total} item(ns) precisam de atenção` : "Tudo em dia"}
                {system?.critical ? ` · ${system.critical} crítico(s)` : ""}
              </p>
            </div>
            <Link href="/alertas" onClick={close} className="text-xs font-semibold text-[#FF2B00]">
              Ver todos
            </Link>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-[#EEF0F3] px-2 py-2 dark:border-[#303343]">
            {TABS.map((t) => {
              const Icon = t.icon;
              const n = countFor(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${tab === t.id ? "bg-[#101828] text-white dark:bg-white dark:text-[#101828]" : "text-[#475467] hover:bg-[#F2F4F7] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"}`}
                >
                  <Icon size={13} aria-hidden />
                  {t.label}
                  {n > 0 && <span className="rounded-full bg-[#FF2B00]/15 px-1.5 text-[10px] font-semibold text-[#FF2B00]">{n}</span>}
                </button>
              );
            })}
          </div>
          {systemItems.length === 0 && commercialItems.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#667085] dark:text-[#AEB4C5]">Nada por aqui.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {systemItems.map((item) => (
                <Link key={item.id} href={item.href} onClick={close} className="block border-b border-[#EEF0F3] px-4 py-3 last:border-0 hover:bg-[#F9FAFB] dark:border-[#303343] dark:hover:bg-[#232532]">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[item.severity]}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
                        {CATEGORY_LABEL[item.category]} · {ago(item.lastSeenAt)}
                        {item.occurrences > 1 ? ` · ${item.occurrences}x` : ""}
                      </p>
                      <p className="text-sm font-semibold text-[#101828] dark:text-white">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-[#667085] dark:text-[#AEB4C5]">{item.detail}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {commercialItems.map((item) => (
                <Link key={item.id} href={item.href} onClick={close} className="block border-b border-[#EEF0F3] px-4 py-3 last:border-0 hover:bg-[#F9FAFB] dark:border-[#303343] dark:hover:bg-[#232532]">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority]}`} />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">Comercial</p>
                      <p className="text-sm font-semibold text-[#101828] dark:text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[#667085] dark:text-[#AEB4C5]">{item.detail}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {(tab === "commercial" || tab === "all") && commercialCount > (notifications?.items.length ?? 0) && (
                <Link href="/comercial/pendencias" onClick={close} className="block px-4 py-2.5 text-center text-xs font-semibold text-[#FF2B00] hover:bg-[#F9FAFB] dark:hover:bg-[#232532]">
                  Ver todas as pendências comerciais
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
