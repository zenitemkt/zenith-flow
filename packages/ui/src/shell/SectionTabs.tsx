"use client";

import type { ElementType } from "react";
import type { NavigationItem } from "../navigation/types";

export interface SectionTabsProps {
  /** Item de sidebar cujas `children` viram abas (ex.: "Financeiro"). */
  item: NavigationItem;
  activePath: string;
  linkComponent?: ElementType;
}

/**
 * Abas horizontais no topo do conteúdo (pedido do usuário, 2026-09-08,
 * inspirado no Kiiru): a sidebar não abre mais accordion — as "subdivisões"
 * de um item (ex.: Financeiro → Visão geral/A receber/A pagar/DRE...) viram
 * essas abas, renderizadas por `AppShell` quando a rota ativa bate com uma
 * delas.
 */
export function SectionTabs({ item, activePath, linkComponent }: SectionTabsProps) {
  const Link = linkComponent ?? "a";
  const tabs = item.children ?? [];
  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label={`Seções de ${item.label}`}
      className="mb-6 flex flex-wrap gap-1.5 rounded-[12px] border border-[#E4E7EC] bg-white p-1 shadow-[0_1px_0_rgba(16,24,40,0.03)] dark:border-[#303343] dark:bg-[#171821]"
    >
      {tabs.map((tab) => {
        const active = tab.href === activePath;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors",
              active
                ? "bg-[#FFF1EC] text-[#C2270A] dark:bg-[#3A2015] dark:text-[#FFB499]"
                : "text-[#475467] hover:bg-[#F6F7FB] hover:text-[#101828] dark:text-[#CFD3DF] dark:hover:bg-[#232532] dark:hover:text-white",
            ].join(" ")}
          >
            {tab.label}
            {tab.comingSoon && (
              <span className="rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#92600A]">
                em breve
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Acha o item de navegação (com 2+ subdivisões) dono da rota ativa, se houver. */
export function findTabbedItemForPath(
  groups: { items: NavigationItem[] }[],
  activePath: string,
): NavigationItem | undefined {
  for (const group of groups) {
    for (const item of group.items) {
      const tabHrefs = item.children?.map((child) => child.href) ?? [];
      if (tabHrefs.length >= 2 && tabHrefs.includes(activePath)) {
        return item;
      }
    }
  }
  return undefined;
}
