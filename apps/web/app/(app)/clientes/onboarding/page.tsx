import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { prisma } from "@zenite-mkt/db";
import type { OnboardingRunStatus } from "@zenite-mkt/db";

const RUN_STATUS_LABELS: Record<OnboardingRunStatus, string> = {
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADO: "Bloqueado",
  PRONTO: "Pronto",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const RUN_STATUS_BADGE_CLASS: Record<OnboardingRunStatus, string> = {
  EM_ANDAMENTO: "bg-[#EEF2FF] text-[#3730A3]",
  BLOQUEADO: "bg-[#FEE4E2] text-[#B42318]",
  PRONTO: "bg-[#FEF3C7] text-[#92600A]",
  CONCLUIDO: "bg-[#DCFCE7] text-[#166534]",
  CANCELADO: "bg-[#F2F4F7] text-[#475467]",
};

/** Seção 11 do manual: "progresso por cliente" — visão cross-cliente sobre o mesmo dado já usado no checklist individual (`OnboardingRun`/`OnboardingItem`), sem tabela nova. */
export default async function ClientsOnboardingPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const clients = await prisma.client.findMany({
    where: { agencyId: membership.agencyId },
    include: {
      onboardingRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: { items: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = clients
    .map((client) => {
      const run = client.onboardingRuns[0];
      if (!run) return null;
      const total = run.items.length;
      const done = run.items.filter((item) => item.status === "CONCLUIDO").length;
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);
      return { client, run, total, done, percent };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const inProgress = rows
    .filter((row) => row.run.status === "EM_ANDAMENTO" || row.run.status === "BLOQUEADO" || row.run.status === "PRONTO")
    .sort((a, b) => a.run.startedAt.getTime() - b.run.startedAt.getTime());
  const finished = rows
    .filter((row) => row.run.status === "CONCLUIDO" || row.run.status === "CANCELADO")
    .sort((a, b) => b.run.startedAt.getTime() - a.run.startedAt.getTime())
    .slice(0, 20);

  function Row({ row }: { row: (typeof rows)[number] }) {
    return (
      <Link
        key={row.client.id}
        href={`/clientes/${row.client.id}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-[#EEF0F3] bg-white px-3 py-2.5 hover:border-[#FF2B00]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#101828]">{row.client.name}</p>
          <div className="mt-1.5 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-[#F2F4F7]">
            <div
              className="h-full rounded-full bg-[#FF2B00]"
              style={{ width: `${row.percent}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-[#98A2B3]">
            {row.done}/{row.total} itens
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RUN_STATUS_BADGE_CLASS[row.run.status]}`}>
            {RUN_STATUS_LABELS[row.run.status]}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Onboarding</h1>
        <p className="text-sm text-[#667085]">
          Progresso de onboarding por cliente (seção 11 do manual) — mesmo checklist já visto no perfil de cada
          cliente, reunido numa visão só.
        </p>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#101828]">Em andamento</h2>
        {inProgress.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nenhum cliente em onboarding no momento.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {inProgress.map((row) => (
              <Row key={row.client.id} row={row} />
            ))}
          </div>
        )}
      </section>

      {finished.length > 0 && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Concluídos e cancelados recentemente</h2>
          <div className="flex flex-col gap-2">
            {finished.map((row) => (
              <Row key={row.client.id} row={row} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
