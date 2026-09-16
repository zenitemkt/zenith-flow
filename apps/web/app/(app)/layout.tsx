import { redirect } from "next/navigation";
import { requireSessionAndMembership, getUserThemePreference, getActiveMemberships } from "@/lib/session";
import { ROLE_LABELS, isClientRole } from "@/lib/rbac";
import { Shell } from "../_components/Shell";

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

  const [themePreference, memberships] = await Promise.all([
    getUserThemePreference(session.user.id),
    getActiveMemberships(session.user.id),
  ]);

  const agencies = memberships.map((m) => ({ id: m.agencyId, name: m.agency.name }));

  return (
    <Shell
      currentUser={currentUser}
      initialTheme={themePreference}
      agencies={agencies}
      currentAgencyId={membership.agencyId}
    >
      {children}
    </Shell>
  );
}
