import { requirePortalContext } from "@/lib/portal";
import { isDemoEmail, loadDemoRealArt } from "@/lib/portal-demo";
import { PortalShell } from "./PortalShell";
import { DemoPortalApp } from "./demo/DemoPortalApp";

/** Logins de demonstração: veem um painel fictício (só no navegador), ilustrado com as artes da própria Zenite. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session, membership, client } = await requirePortalContext();
  const demo = isDemoEmail(session.user.email);
  const art = demo ? await loadDemoRealArt(membership.agencyId, client.id) : null;

  return (
    <PortalShell agencyName={membership.agency.name} clientName={client.name} demo={demo}>
      {demo ? <DemoPortalApp art={art ?? undefined} /> : children}
    </PortalShell>
  );
}
