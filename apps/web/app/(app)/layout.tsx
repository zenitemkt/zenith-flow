import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
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

  return <Shell currentUser={currentUser}>{children}</Shell>;
}
