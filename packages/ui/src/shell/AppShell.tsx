"use client";

import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { Bell, Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { Sidebar } from "../navigation/Sidebar";
import { MobileDrawer } from "../navigation/MobileDrawer";
import type { NavigationGroup } from "../navigation/types";
import { SectionTabs, findTabbedItemForPath } from "./SectionTabs";
import { CommandPalette } from "./CommandPalette";
import { CommandPaletteProvider } from "./CommandPaletteContext";
import { ToastProvider } from "../patterns/ToastProvider";

export type ThemeMode = "LIGHT" | "DARK";

export interface AppShellProps {
  groups: NavigationGroup[];
  activePath: string;
  linkComponent?: ElementType;
  currentUser?: { name: string; role: string; workspace: string };
  onSignOut?: () => void;
  /** Preferência de tema salva na conta — vinda do servidor, evita "flash" claro/escuro na primeira renderização. */
  initialTheme?: ThemeMode;
  /** Agências às quais o usuário pertence — alimenta o seletor no cabeçalho do menu. 1 item = sem seletor. */
  agencies?: { id: string; name: string }[];
  currentAgencyId?: string;
  onSwitchAgency?: (agencyId: string) => void;
  children: ReactNode;
}

export function AppShell({
  groups,
  activePath,
  linkComponent,
  currentUser,
  onSignOut,
  initialTheme = "LIGHT",
  agencies,
  currentAgencyId,
  onSwitchAgency,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [themeSaving, setThemeSaving] = useState(false);
  const tabbedItem = findTabbedItemForPath(groups, activePath);

  async function toggleTheme() {
    if (themeSaving) return;
    const next: ThemeMode = theme === "DARK" ? "LIGHT" : "DARK";
    const previous = theme;
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "DARK");
    setThemeSaving(true);
    try {
      const response = await fetch("/api/me/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (!response.ok) throw new Error("failed");
    } catch {
      setTheme(previous);
      document.documentElement.classList.toggle("dark", previous === "DARK");
    } finally {
      setThemeSaving(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#F6F7FB] text-[#101828] dark:bg-[#0B0D12] dark:text-[#F3F4F6]">
      <Sidebar
        groups={groups}
        activePath={activePath}
        linkComponent={linkComponent}
        currentUser={currentUser}
        onSignOut={onSignOut}
        agencies={agencies}
        currentAgencyId={currentAgencyId}
        onSwitchAgency={onSwitchAgency}
      />

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#E4E7EC] bg-white/95 px-4 backdrop-blur dark:border-[#303343] dark:bg-[#171821]/95 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir navegação"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#475467] hover:bg-[#F6F7FB] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"
        >
          <Menu size={22} aria-hidden />
        </button>
        <span className="flex items-center gap-2 text-sm font-semibold text-[#101828] dark:text-white">
          <img src="/logo-z.png" alt="" aria-hidden className="h-6 w-6 rounded-md object-cover" />
          ZENITH FLOW
        </span>
      </header>

      <header className="sticky top-0 z-20 hidden h-[68px] items-center gap-3 border-b border-[#E4E7EC]/80 bg-[#F6F7FB]/90 px-8 backdrop-blur-xl dark:border-[#303343]/80 dark:bg-[#0B0D12]/90 md:ml-[92px] md:flex">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-10 min-w-[320px] flex-1 items-center justify-between rounded-[10px] border border-[#E4E7EC] bg-white px-3.5 text-sm text-[#667085] shadow-[0_1px_0_rgba(16,24,40,0.03)] hover:border-[#D0D5DD] focus:outline-none focus:ring-2 focus:ring-[#FF2B00]/25 dark:border-[#303343] dark:bg-[#171821] dark:text-[#AEB4C5] dark:hover:border-[#454965]"
          aria-label="Pesquisar, criar ou perguntar à Zenith AI"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search size={17} className="shrink-0 text-[#98A2B3]" aria-hidden />
            <span className="truncate">Pesquisar, criar ou perguntar à Zenith AI</span>
          </span>
          <kbd className="ml-3 rounded-md border border-[#D0D5DD] bg-[#F9FAFB] px-1.5 py-0.5 text-[11px] font-semibold text-[#475467] dark:border-[#454965] dark:bg-[#232532] dark:text-[#CFD3DF]">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          className="flex h-10 items-center justify-center rounded-[10px] border border-[#E4E7EC] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#FF2B00]/25 dark:border-[#303343] dark:bg-[#171821] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"
        >
          Hoje
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#FF2B00]/25 dark:border-[#303343] dark:bg-[#171821] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"
          aria-label="Notificações"
        >
          <Bell size={17} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => void toggleTheme()}
          disabled={themeSaving}
          aria-label={theme === "DARK" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          aria-pressed={theme === "DARK"}
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#FF2B00]/25 disabled:opacity-60 dark:border-[#303343] dark:bg-[#171821] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"
        >
          {theme === "DARK" ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Criar novo"
          className="flex h-10 items-center gap-2 rounded-[10px] bg-[#FF2B00] px-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,43,0,0.24)] hover:bg-[#E02600] focus:outline-none focus:ring-2 focus:ring-[#FF2B00]/35"
        >
          <Plus size={17} aria-hidden />
          Novo
        </button>
      </header>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        groups={groups}
        activePath={activePath}
        linkComponent={linkComponent}
      />

      <main className="px-4 py-6 md:ml-[92px] md:px-8 md:py-7">
        {tabbedItem && (
          <SectionTabs item={tabbedItem} activePath={activePath} linkComponent={linkComponent} />
        )}
        <CommandPaletteProvider onOpen={() => setPaletteOpen(true)}>{children}</CommandPaletteProvider>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={groups}
        linkComponent={linkComponent}
      />
    </div>
    </ToastProvider>
  );
}
