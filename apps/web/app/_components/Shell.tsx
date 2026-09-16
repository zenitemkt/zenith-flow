"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell, navigationGroups, type ThemeMode } from "@zenith/ui";
import { authClient } from "@/lib/auth-client";

interface ShellProps {
  currentUser: { name: string; role: string; workspace: string };
  initialTheme?: ThemeMode;
  agencies: { id: string; name: string }[];
  currentAgencyId: string;
  children: ReactNode;
}

export function Shell({
  currentUser,
  initialTheme,
  agencies,
  currentAgencyId,
  children,
}: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleSwitchAgency(agencyId: string) {
    if (agencyId === currentAgencyId) return;
    const response = await fetch("/api/me/agency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyId }),
    });
    if (!response.ok) return;
    // Página atual pode referenciar um recurso que só existe na agência
    // anterior — volta para o início, mesma cautela do sign-out.
    router.push("/");
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
      agencies={agencies}
      currentAgencyId={currentAgencyId}
      onSwitchAgency={handleSwitchAgency}
    >
      {children}
    </AppShell>
  );
}
