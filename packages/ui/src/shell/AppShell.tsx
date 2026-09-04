"use client";

import { useState, type ElementType, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "../navigation/Sidebar";
import { MobileDrawer } from "../navigation/MobileDrawer";
import type { NavigationGroup } from "../navigation/types";

export interface AppShellProps {
  groups: NavigationGroup[];
  activePath: string;
  linkComponent?: ElementType;
  currentUser?: { name: string; role: string; workspace: string };
  onSignOut?: () => void;
  children: ReactNode;
}

export function AppShell({
  groups,
  activePath,
  linkComponent,
  currentUser,
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <Sidebar
        groups={groups}
        activePath={activePath}
        linkComponent={linkComponent}
        currentUser={currentUser}
        onSignOut={onSignOut}
      />

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#E4E7EC] bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir navegação"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#475467] hover:bg-[#F6F7FB]"
        >
          <Menu size={22} aria-hidden />
        </button>
        <span className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ backgroundColor: "#6847F5" }}
          >
            Z
          </span>
          ZENITH FLOW
        </span>
      </header>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        groups={groups}
        activePath={activePath}
        linkComponent={linkComponent}
      />

      <main className="px-4 py-6 md:ml-[92px] md:px-8 md:py-8">{children}</main>
    </div>
  );
}
