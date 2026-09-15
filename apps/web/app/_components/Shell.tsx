"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell, navigationGroups, type ThemeMode } from "@zenith/ui";
import { authClient } from "@/lib/auth-client";

interface ShellProps {
  currentUser: { name: string; role: string; workspace: string };
  initialTheme?: ThemeMode;
  children: ReactNode;
}

export function Shell({ currentUser, initialTheme, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <AppShell
      groups={navigationGroups}
      activePath={pathname}
      linkComponent={Link}
      currentUser={currentUser}
      onSignOut={handleSignOut}
      initialTheme={initialTheme}
    >
      {children}
    </AppShell>
  );
}
