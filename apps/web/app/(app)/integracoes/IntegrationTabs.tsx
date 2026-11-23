import Link from "next/link";

export type IntegrationTab = "meta" | "google" | "site" | "conteudo";
export const INTEGRATION_TABS: { id: IntegrationTab; label: string }[] = [
  { id: "meta", label: "Meta" },
  { id: "google", label: "Google" },
  { id: "site", label: "Site" },
  { id: "conteudo", label: "Conteúdo" },
];

/** Abas de Integrações (navegação por link, sem JS: o estado vive na URL), mesmo padrão de CompetitorTabs. */
export function IntegrationTabs({ active }: { active: IntegrationTab }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#E4E7EC]">
      {INTEGRATION_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/integracoes?tab=${tab.id}`}
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
