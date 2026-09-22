"use client";

import { useEffect, useRef, type ElementType, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import type { NavigationGroup, NavigationItem } from "./types";

function isItemActive(item: NavigationItem, activePath: string): boolean {
  if (item.href === activePath) return true;
  return item.children?.some((child) => child.href === activePath) ?? false;
}

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  groups: NavigationGroup[];
  activePath: string;
  linkComponent?: ElementType;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function MobileDrawer({
  open,
  onClose,
  groups,
  activePath,
  linkComponent,
}: MobileDrawerProps) {
  const Link = linkComponent ?? "a";
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = panelRef.current ? getFocusable(panelRef.current) : [];
    focusable[0]?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="presentation">
      <button
        type="button"
        aria-label="Fechar navegação"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navegação principal"
        onKeyDown={handleKeyDown}
        className="absolute left-0 top-0 flex h-full w-[85vw] max-w-[320px] flex-col bg-[#171821] text-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#303343] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF2B00] text-xs font-bold text-white">
              Z
            </span>
            ZENITE MKT
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar navegação"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[#AEB4C5] hover:bg-[#232532] hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <nav aria-label="Navegação principal (mobile)" className="flex-1 overflow-y-auto px-3 py-2">
          {groups.map((group) => (
            <div key={group.id} className="py-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8E93A6]">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(item, activePath);
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm",
                          active
                            ? "bg-[#2A2D3D] font-semibold text-white shadow-[inset_3px_0_0_#FF2B00]"
                            : "font-medium text-[#CFD3DF] hover:bg-[#232532] hover:text-white",
                        ].join(" ")}
                      >
                        <span className="truncate">{item.label}</span>
                        {item.comingSoon && (
                          <span className="ml-auto shrink-0 rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#92600A]">
                            em desenvolvimento
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
