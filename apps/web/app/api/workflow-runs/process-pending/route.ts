import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { processPendingWorkflowRuns } from "@/lib/workflow-engine";

/** "Processar automações pendentes" — botão manual, mesmo padrão de Rotinas/Recorrências (sem cron real). */
export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const result = await processPendingWorkflowRuns(membership.agencyId);

  return NextResponse.json(result);
}
