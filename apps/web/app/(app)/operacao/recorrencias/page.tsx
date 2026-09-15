import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { getAgencyMembers } from "@/lib/team";
import {
  RECURRENCE_MODE_LABELS,
  RECURRING_TASK_STATUS_LABELS,
  formatPeriodLabel,
  hasPendingGeneration,
} from "@/lib/recurring-tasks";
import { prisma, type RecurringTaskStatus } from "@zenith/db";
import { RecurringTaskActions } from "./RecurringTaskActions";

const STATUS_BADGE_CLASS: Record<RecurringTaskStatus, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ATIVO: "bg-[#DCFCE7] text-[#166534]",
  PAUSADO: "bg-[#FEF3C7] text-[#92600A]",
};

const STATUS_ORDER: Record<RecurringTaskStatus, number> = { ATIVO: 0, PAUSADO: 1, RASCUNHO: 2 };

export default async function RecurringTasksPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [templates, people] = await Promise.all([
    prisma.recurringTaskTemplate.findMany({
      where: { agencyId: membership.agencyId },
      include: {
        client: { select: { id: true, name: true } },
        assignees: { orderBy: { order: "asc" } },
        checklistItems: true,
        dates: { orderBy: { date: "asc" } },
        generations: { orderBy: { createdAt: "desc" } },
      },
    }),
    getAgencyMembers(membership.agencyId),
  ]);

  const nameByUserId = new Map(people.map((p) => [p.userId, p.name]));
  const sorted = [...templates].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Recorrências</h1>
        <p className="text-sm text-[#667085]">
          Tarefas recorrentes de {membership.agency.name} — cada geração cria uma tarefa nova no board de{" "}
          <a href="/operacao" className="text-[#FF2B00] hover:underline">
            Operação
          </a>
          . Geração é manual, mesmo padrão de tudo que dependeria de um cron real.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhuma recorrência ainda. Crie uma marcando &quot;Tarefa Recorrente&quot; ao criar um card em Operação.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((template) => {
            const lastGeneration = template.generations[0];
            const pending = hasPendingGeneration(template);
            return (
              <div
                key={template.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#101828]">{template.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[template.status]}`}
                    >
                      {RECURRING_TASK_STATUS_LABELS[template.status]}
                    </span>
                    {pending && template.status === "ATIVO" && (
                      <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92600A]">
                        pendente
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#667085]">
                    {template.client?.name ?? "Interna"} · {RECURRENCE_MODE_LABELS[template.recurrenceMode]}
                    {template.recurrenceMode === "MENSAL"
                      ? ` (dia ${template.dayOfMonth})`
                      : ` (${template.dates.length} data(s))`}
                    {template.estimatedMinutes !== null &&
                      ` · ${
                        template.estimatedMinutes >= 60
                          ? `${Math.round(template.estimatedMinutes / 60)}h`
                          : `${template.estimatedMinutes}min`
                      }`}
                  </p>
                  {template.assignees.length > 0 && (
                    <p className="mt-1 text-xs text-[#98A2B3]">
                      Fila: {template.assignees.map((a) => nameByUserId.get(a.userId) ?? "Ex-membro").join(" → ")}
                    </p>
                  )}
                  {template.checklistItems.length > 0 && (
                    <p className="mt-1 text-xs text-[#98A2B3]">
                      Checklist: {template.checklistItems.length} item{template.checklistItems.length === 1 ? "" : "s"}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[#98A2B3]">
                    {lastGeneration
                      ? `Última geração: ${formatPeriodLabel(lastGeneration.period)}`
                      : "Nenhuma geração ainda"}
                  </p>
                </div>
                <RecurringTaskActions templateId={template.id} status={template.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
