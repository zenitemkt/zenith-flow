import { Schibsted_Grotesk } from "next/font/google";
import { requirePortalContext } from "@/lib/portal";
import { PortalShell } from "./PortalShell";

/** Fonte de títulos só do Portal do Cliente — o corpo continua em Inter, como no resto do produto. */
const display = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { membership, client } = await requirePortalContext();

  return (
    <div className={display.variable}>
      <PortalShell agencyName={membership.agency.name} clientName={client.name}>
        {children}
      </PortalShell>
    </div>
  );
}
