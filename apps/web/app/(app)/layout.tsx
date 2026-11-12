import { redirect } from "next/navigation";
import { requireSessionAndMembership, getUserThemePreference, getActiveMemberships } from "@/lib/session";
import { ROLE_LABELS, isClientRole } from "@/lib/rbac";
import { Shell } from "../_components/Shell";
import { getCommercialPendencies } from "@/lib/commercial-pendencies";
import { SocialPublishTicker } from "@/components/SocialPublishTicker";
import { getDisabledAlertTypes, getSystemAlertSummary } from "@/lib/system-alerts";

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

  const [themePreference, memberships, commercialPendencies, systemAlerts] = await Promise.all([
    getUserThemePreference(session.user.id),
    getActiveMemberships(session.user.id),
    getCommercialPendencies(membership.agencyId),
    getSystemAlertSummary(membership.agencyId),
  ]);
  const commercialOff = (await getDisabledAlertTypes(membership.agencyId)).has("commercial");

  const agencies = memberships.map((m) => ({ id: m.agencyId, name: m.agency.name }));

  return (
    <Shell
      currentUser={currentUser}
      initialTheme={themePreference}
      agencies={agencies}
      currentAgencyId={membership.agencyId}
      notifications={{ count: commercialOff ? 0 : commercialPendencies.summary.total, items: (commercialOff ? [] : commercialPendencies.items).slice(0, 6).map(({ id, title, detail, href, priority }) => ({ id, title, detail, href, priority })), system: systemAlerts }}
    >
      <SocialPublishTicker />
      {children}
    </Shell>
  );
}
