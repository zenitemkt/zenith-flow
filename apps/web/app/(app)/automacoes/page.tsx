import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { WORKFLOW_STATUS_LABELS, WORKFLOW_STATUS_BADGE_CLASS, findTriggerEvent } from "@/lib/workflows";
import { prisma } from "@zenite-mkt/db";
import { NewWorkflowModal } from "./NewWorkflowModal";
import { ProcessPendingButton } from "./ProcessPendingButton";

export default async function AutomationsPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const workflows = await prisma.workflow.findMany({
    where: { agencyId: membership.agencyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Automações</h1>
          <p className="text-sm text-[#667085]">
            {workflows.length} automaç{workflows.length === 1 ? "ão" : "ões"} em {membership.agency.name} (seção 40
            do manual) — sem worker/cron real ainda, esperas avançam manualmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProcessPendingButton />
          <NewWorkflowModal />
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma automação ainda. Crie a primeira.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Automação</th>
                <th className="px-4 py-3">Gatilho</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link href={`/automacoes/${workflow.id}`} className="font-medium text-[#101828] hover:text-[#FF2B00]">
                      {workflow.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{findTriggerEvent(workflow.triggerEvent)?.label ?? workflow.triggerEvent}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${WORKFLOW_STATUS_BADGE_CLASS[workflow.status]}`}>
                      {WORKFLOW_STATUS_LABELS[workflow.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
