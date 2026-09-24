"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { LogOut } from "lucide-react";
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

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A marca do portal: a borda de um "planeta" escuro sendo iluminada por trás,
 * como o sol cruzando o horizonte visto do alto — o zênite que dá nome à
 * agência. É o único elemento decorativo; o resto da interface fica quieto.
 */
function ZenithArc() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"
    >
      <div
        className="zenite-dawn absolute left-1/2 top-[-2476px] h-[2640px] w-[2640px] rounded-full bg-[#07080C] lg:top-[-2528px]"
        style={{
          boxShadow:
            "0 1px 0 0 rgba(255,168,110,0.95), 0 4px 18px 0 rgba(255,90,30,0.75), 0 30px 90px 10px rgba(255,43,0,0.38), 0 90px 220px 60px rgba(255,43,0,0.16)",
        }}
      />
    </div>
  );
}

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
  const mobileNavRef = useRef<HTMLElement | null>(null);

  // No celular a navegação rola na horizontal — mantém a aba atual à vista.
  useEffect(() => {
    const active = mobileNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const navLink = (item: (typeof NAV_ITEMS)[number], compact: boolean) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A] ${
          active
            ? "bg-white/[0.08] text-[#F5F2EE] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            : "text-[#A3A5B2] hover:text-[#F5F2EE]"
        } ${compact ? "py-2" : ""}`}
      >
        {item.label}
        {active && (
          <span
            aria-hidden
            className="absolute -bottom-px left-1/2 h-px w-6 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#FF5A1E] to-transparent"
          />
        )}
      </Link>
    );
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0A0B10] text-[#F5F2EE] selection:bg-[#FF2B00]/40 selection:text-white">
      <ZenithArc />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A0B10]/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/portal"
            className="flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF2B00] font-display text-[15px] font-bold text-white shadow-[0_0_28px_rgba(255,43,0,0.45)]">
              Z
            </span>
            <span className="leading-tight">
              <span className="block text-xs text-[#8B8D9A]">{agencyName}</span>
              <span className="block max-w-[180px] truncate text-sm font-semibold text-[#F5F2EE]">{clientName}</span>
            </span>
          </Link>

          <nav aria-label="Portal do cliente" className="hidden flex-1 justify-center lg:flex">
            <div className="flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
              {NAV_ITEMS.map((item) => navLink(item, false))}
            </div>
          </nav>

          <button
            type="button"
            onClick={handleSignOut}
            className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-[#A3A5B2] transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A] lg:ml-0"
          >
            <LogOut size={15} aria-hidden />
            Sair
          </button>
        </div>

        <nav
          ref={mobileNavRef}
          aria-label="Portal do cliente"
          className="flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
        >
          {NAV_ITEMS.map((item) => navLink(item, true))}
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 lg:pt-16">{children}</main>
    </div>
  );
}
