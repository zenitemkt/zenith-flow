import Link from "next/link";

export type CompetitorTab = "geral" | "instagram" | "google" | "site";
export const COMPETITOR_TABS: { id: CompetitorTab; label: string }[] = [
  { id: "geral", label: "Visão geral" },
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google Meu Negócio" },
  { id: "site", label: "Site" },
];

/** Abas da Análise de Concorrentes (navegação por link, sem JS: o estado vive na URL). */
export function CompetitorTabs({ active, baseHref }: { active: CompetitorTab; baseHref: string }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#E4E7EC]">
      {COMPETITOR_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`${baseHref}&aba=${tab.id}`}
          className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium ${
            active === tab.id ? "border-[#FF2B00] text-[#FF2B00]" : "border-transparent text-[#667085] hover:text-[#344054]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
