import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import {
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUS_BADGE_CLASS,
  WORKFLOW_STATUS_TRANSITIONS,
  WORKFLOW_RUN_STATUS_LABELS,
  WORKFLOW_RUN_STATUS_BADGE_CLASS,
  findTriggerEvent,
  type WorkflowStep,
} from "@/lib/workflows";
import { prisma } from "@zenith/db";
import { WorkflowStatusActions } from "./WorkflowStatusActions";
import { PublishButton } from "./PublishButton";
import { DraftStepBuilder } from "./DraftStepBuilder";

interface PageProps {
  params: { id: string };
}

function summarizeStepReadOnly(step: WorkflowStep): string {
  if (step.type === "CONDICAO") return `Condição: ${step.field} ${step.operator} ${step.value}`;
  if (step.type === "ESPERA") return `Espera: ${step.minutes} min`;
  if (step.action === "create_task") return `Ação: criar tarefa "${step.title}"`;
  if (step.action === "add_lead_note") return `Ação: adicionar nota ao lead`;
  return `Ação: chamar webhook ${step.url}`;
}

export default async function WorkflowDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: params.id },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { runs: { orderBy: { startedAt: "desc" }, take: 20 } },
      },
    },
  });

  if (!workflow || workflow.agencyId !== membership.agencyId) {
    notFound();
  }

  const trigger = findTriggerEvent(workflow.triggerEvent);
  const latestVersion = workflow.versions[0];
  const draftSteps = workflow.draftSteps as unknown as WorkflowStep[];
  const publishedSteps = latestVersion ? (latestVersion.steps as unknown as WorkflowStep[]) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[#101828]">
            {workflow.name}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${WORKFLOW_STATUS_BADGE_CLASS[workflow.status]}`}>
              {WORKFLOW_STATUS_LABELS[workflow.status]}
            </span>
          </h1>
          <p className="text-sm text-[#667085]">Gatilho: {trigger?.label ?? workflow.triggerEvent}</p>
        </div>
        <div className="flex items-center gap-2">
          {workflow.status === "RASCUNHO" && <PublishButton workflowId={workflow.id} />}
          <WorkflowStatusActions workflowId={workflow.id} options={WORKFLOW_STATUS_TRANSITIONS[workflow.status]} />
        </div>
      </div>

      {workflow.status === "RASCUNHO" ? (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-[#101828]">Passos (rascunho)</h2>
          <p className="mb-3 text-xs text-[#98A2B3]">
            Workflow em rascunho não executa (seção 40) — só depois de publicado ele passa a rodar quando o gatilho
            acontecer. Depois de publicado, os passos não podem mais ser editados nesta fatia.
          </p>
          <DraftStepBuilder workflowId={workflow.id} fields={trigger?.fields ?? []} initialSteps={draftSteps} />
        </section>
      ) : (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Passos publicados (versão {latestVersion?.version})</h2>
          <div className="flex flex-col gap-1.5">
            {publishedSteps.map((step, index) => (
              <div key={index} className="rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm text-[#101828]">
                <span className="mr-2 text-xs font-semibold text-[#98A2B3]">{index + 1}.</span>
                {summarizeStepReadOnly(step)}
              </div>
            ))}
          </div>
        </section>
      )}

      {latestVersion && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Execuções recentes</h2>
          {latestVersion.runs.length === 0 ? (
            <p className="text-sm text-[#98A2B3]">Nenhuma execução ainda — dispara quando o gatilho acontecer de verdade.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {latestVersion.runs.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm">
                  <span className="text-[#101828]">
                    {run.subjectType} · passo {run.currentStepIndex + 1}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[#98A2B3]">
                    {run.startedAt.toLocaleString("pt-BR")}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${WORKFLOW_RUN_STATUS_BADGE_CLASS[run.status]}`}>
                      {WORKFLOW_RUN_STATUS_LABELS[run.status]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
