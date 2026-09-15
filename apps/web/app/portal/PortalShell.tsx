"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { href: "/portal", label: "Início" },
  { href: "/portal/calendario", label: "Calendário" },
  { href: "/portal/aprovacoes", label: "Aprovações" },
  { href: "/portal/solicitacoes", label: "Solicitações" },
  { href: "/portal/arquivos", label: "Arquivos" },
  { href: "/portal/trafego", label: "Tráfego pago" },
  { href: "/portal/financeiro", label: "Financeiro" },
];

export function PortalShell({
  agencyName,
  clientName,
  children,
}: {
  agencyName: string;
  clientName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <header className="border-b border-[#E4E7EC] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
              {agencyName}
            </p>
            <p className="text-sm font-semibold text-[#101828]">{clientName}</p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    active ? "bg-[#FFF1EC] text-[#FF2B00]" : "text-[#475467] hover:bg-[#F6F7FB]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-2 rounded-lg px-3 py-2 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">{children}</main>
    </div>
  );
}
