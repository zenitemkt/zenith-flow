import { requirePortalContext } from "@/lib/portal";
import { PortalShell } from "./PortalShell";
import { DemoPortalApp } from "./demo/DemoPortalApp";

/** Logins de demonstração: veem um painel fictício (só no navegador), nunca dados do CRM. */
const DEMO_EMAILS = (process.env.DEMO_PORTAL_EMAILS || "demo@zenitehub.com.br").split(",").map((e) => e.trim().toLowerCase());

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session, membership, client } = await requirePortalContext();
  const demo = DEMO_EMAILS.includes(session.user.email.toLowerCase());

  return (
    <PortalShell agencyName={membership.agency.name} clientName={client.name}>
      {demo ? <DemoPortalApp /> : children}
    </PortalShell>
  );
}
