import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { formatCents } from "@/lib/finance";
import {
  collectionStageForDueDate,
  daysOverdue,
  COLLECTION_STAGE_LABELS,
  COLLECTION_STAGE_BADGE_CLASS,
  COLLECTION_TASK_ELIGIBLE_STAGES,
  type CollectionStage,
} from "@/lib/collection-ladder";
import { prisma } from "@zenith/db";
import { CreateCollectionTaskButton } from "./CreateCollectionTaskButton";

const STAGE_ORDER: CollectionStage[] = ["RECUPERACAO", "ESCALONAR", "ATRASO_3", "ATRASO_1", "VENCIMENTO", "LEMBRETE"];

export default async function CobrancasPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const entries = await prisma.financeEntry.findMany({
    where: {
      agencyId: membership.agencyId,
      type: "RECEITA",
      status: { in: ["PREVISTO", "PENDENTE", "VENCIDO"] },
    },
    include: { client: { select: { name: true } }, collectionTask: { select: { id: true, projectId: true } } },
  });

  const rows = entries
    .map((entry) => ({ entry, stage: collectionStageForDueDate(entry.dueDate) }))
    .filter((row): row is { entry: (typeof entries)[number]; stage: CollectionStage } => row.stage !== null)
    .sort((a, b) => {
      const stageDiff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      return daysOverdue(b.entry.dueDate) - daysOverdue(a.entry.dueDate);
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Régua de cobrança</h1>
        <p className="text-sm text-[#667085]">
          Contas a receber de {membership.agency.name}, de D-5 (lembrete) a D+15 (plano de recuperação) — seção 28
          do manual. Nenhuma suspensão é automática.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma fatura na janela da régua (D-5 a D+15+) agora.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ entry, stage }) => {
            const overdue = daysOverdue(entry.dueDate);
            const canCreateTask = COLLECTION_TASK_ELIGIBLE_STAGES.includes(stage) && !entry.collectionTask;
            return (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#101828]">{entry.description}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLLECTION_STAGE_BADGE_CLASS[stage]}`}
                    >
                      {COLLECTION_STAGE_LABELS[stage]}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085]">
                    {entry.client?.name ?? "Sem cliente"} · Vencimento {entry.dueDate.toLocaleDateString("pt-BR")} ·{" "}
                    {overdue === 0 ? "vence hoje" : overdue > 0 ? `${overdue} dia(s) de atraso` : `vence em ${-overdue} dia(s)`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-[#166534]">{formatCents(entry.amountCents)}</p>
                  {entry.collectionTask ? (
                    <Link
                      href={`/operacao/projetos/${entry.collectionTask.projectId}`}
                      className="text-xs font-medium text-[#6847F5] hover:underline"
                    >
                      Ver tarefa de cobrança
                    </Link>
                  ) : canCreateTask ? (
                    <CreateCollectionTaskButton entryId={entry.id} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
