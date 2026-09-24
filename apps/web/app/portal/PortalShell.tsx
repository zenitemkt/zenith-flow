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
  { href: "/portal/grafica", label: "Peças gráficas" },
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#0A0B10]">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-220px] h-[640px] w-[640px] -translate-x-1/2 rounded-full opacity-60 blur-[130px]"
        style={{ background: "radial-gradient(circle, #FF2B00 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[calc(50%+220px)] top-[160px] h-[420px] w-[420px] rounded-full opacity-40 blur-[110px]"
        style={{ background: "radial-gradient(circle, #FF7A1A 0%, transparent 70%)" }}
      />

      <header className="relative border-b border-[#2F3140]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8E93A6]">
              {agencyName}
            </p>
            <p className="text-sm font-semibold text-white">{clientName}</p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    active ? "bg-[#232532] text-[#FF6A3D]" : "text-[#CFD3DF] hover:bg-[#232532] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-2 rounded-lg px-3 py-2 text-sm font-medium text-[#CFD3DF] hover:bg-[#232532] hover:text-white"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="relative mx-auto max-w-5xl px-6 py-6">{children}</main>
    </div>
  );
}
