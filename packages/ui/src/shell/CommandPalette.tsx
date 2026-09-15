"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import type { NavigationGroup } from "../navigation/types";

interface FlatNavItem {
  label: string;
  href: string;
}

function flattenGroups(groups: NavigationGroup[]): FlatNavItem[] {
  const out: FlatNavItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.href) out.push({ label: item.label, href: item.href });
      for (const child of item.children ?? []) {
        if (child.href) out.push({ label: `${item.label} · ${child.label}`, href: child.href });
      }
    }
  }
  return out;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: NavigationGroup[];
  linkComponent?: ElementType;
  /** Atalhos exibidos quando a busca está vazia. */
  quickActions?: FlatNavItem[];
}

const DEFAULT_QUICK_ACTIONS: FlatNavItem[] = [
  { label: "Criar cliente", href: "/clientes/carteira" },
  { label: "Abrir quadro", href: "/operacao" },
  { label: "Nova cobrança", href: "/financeiro/cobrancas" },
  { label: "Ver risco de churn", href: "/clientes/risco" },
];

/**
 * Busca/navegação rápida global (protótipo `/prototype`: `#commandPalette`).
 * A marca "AI" já reflete a intenção da seção 42 do manual (Zenith AI), mas
 * hoje só faz busca real na navegação — sem inventar resposta de IA que
 * ainda não existe (`zenith-ai` segue `comingSoon: true`).
 */
export function CommandPalette({ open, onClose, groups, linkComponent, quickActions }: CommandPaletteProps) {
  const Link = linkComponent ?? "a";
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const flat = useMemo(() => flattenGroups(groups), [groups]);
  const actions = quickActions ?? DEFAULT_QUICK_ACTIONS;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return flat.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 8);
  }, [flat, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-center bg-[#101828]/[0.34] px-4 pt-[12vh]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pesquisar, criar ou perguntar à Zenith AI"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="h-fit w-full max-w-[720px] overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-[0_18px_48px_rgba(16,24,40,0.22)]"
      >
        <div className="flex items-center gap-3 border-b border-[#E4E7EC] px-4 py-3.5">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-sm font-extrabold text-white"
            style={{ backgroundColor: "#FF2B00" }}
          >
            AI
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite: cliente, tarefa, cobrança, lead..."
            className="w-full border-0 bg-transparent text-base text-[#101828] outline-none placeholder:text-[#98A2B3]"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-3">
          {results ? (
            results.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {results.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="flex min-h-[42px] items-center rounded-[10px] px-3 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-4 text-sm text-[#98A2B3]">Nada encontrado para &quot;{query}&quot;.</p>
            )
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={onClose}
                  className="flex min-h-[46px] items-center rounded-[10px] border border-[#E4E7EC] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
