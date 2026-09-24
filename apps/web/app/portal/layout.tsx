import { requirePortalContext } from "@/lib/portal";
import { PortalShell } from "./PortalShell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { membership, client } = await requirePortalContext();

  return (
    <PortalShell agencyName={membership.agency.name} clientName={client.name}>
      {children}
    </PortalShell>
  );
}
