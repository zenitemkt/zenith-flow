import { redirect } from "next/navigation";
import { requireSessionAndMembership, getUserThemePreference, getActiveMemberships } from "@/lib/session";
import { ROLE_LABELS, isClientRole } from "@/lib/rbac";
import { Shell } from "../_components/Shell";
import { getCommercialPendencies } from "@/lib/commercial-pendencies";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, membership } = await requireSessionAndMembership();

  if (!session) {
    redirect("/login");
  }

  if (!membership) {
    redirect("/nova-agencia");
  }

  if (isClientRole(membership.role)) {
    redirect("/portal");
  }

  const currentUser = {
    name: session.user.name,
    role: ROLE_LABELS[membership.role],
    workspace: membership.agency.name,
  };

  const [themePreference, memberships, commercialPendencies] = await Promise.all([
    getUserThemePreference(session.user.id),
    getActiveMemberships(session.user.id),
    getCommercialPendencies(membership.agencyId),
  ]);

  const agencies = memberships.map((m) => ({ id: m.agencyId, name: m.agency.name }));

  return (
    <Shell
      currentUser={currentUser}
      initialTheme={themePreference}
      agencies={agencies}
      currentAgencyId={membership.agencyId}
      notifications={{ count: commercialPendencies.summary.total, items: commercialPendencies.items.slice(0, 6).map(({ id, title, detail, href, priority }) => ({ id, title, detail, href, priority })) }}
    >
      {children}
    </Shell>
  );
}
