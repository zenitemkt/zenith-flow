import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { hasPendingGeneration } from "@/lib/recurring-tasks";
import { startOfWeekUTC } from "@/lib/timesheets";
import { WORK_ITEM_STATUS_LABELS } from "@/lib/tasks";
import { formatCents } from "@/lib/finance";
import { bandForScore } from "@/lib/health-score";
import { startOfDayUTC } from "@/lib/dates";
import { prisma } from "@zenith/db";

const MONTH_LABELS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function HomePage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const now = new Date();
  const sixWeeksAgo = new Date(now);
  sixWeeksAgo.setUTCDate(sixWeeksAgo.getUTCDate() - 42);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const todayStart = startOfDayUTC(now);

  const [
    activeRecurring,
    overdueTasksCount,
    pendingApprovalsCount,
    unassignedTasksCount,
    pendingLeavesCount,
    overdueInvoicesCount,
    myTasks,
    completedTasks,
    activeClientsCount,
    aReceberAgg,
    aPagarAgg,
    recebidoMesAgg,
    pagoMesAgg,
    revenueEntries,
    latestHealthSnapshots,
  ] = await Promise.all([
    prisma.recurringTaskTemplate.findMany({
      where: { agencyId: membership.agencyId, status: "ATIVO" },
      include: { generations: { select: { period: true } }, dates: { select: { date: true } }, client: { select: { name: true } } },
    }),
    prisma.task.count({
      where: {
        project: { agencyId: membership.agencyId },
        dueDate: { lt: todayStart },
        status: { notIn: ["CONCLUIDA", "CANCELADA"] },
      },
    }),
    prisma.contentApproval.count({
      where: { status: "PENDENTE", contentVersion: { contentItem: { agencyId: membership.agencyId } } },
    }),
    prisma.task.count({
      where: { project: { agencyId: membership.agencyId }, status: "BACKLOG", assigneeUserId: null },
    }),
    prisma.leaveRequest.count({ where: { agencyId: membership.agencyId, status: "SOLICITADA" } }),
    prisma.financeEntry.count({
      where: {
        agencyId: membership.agencyId,
        OR: [{ status: "VENCIDO" }, { status: "PENDENTE", dueDate: { lt: todayStart } }],
      },
    }),
    prisma.task.findMany({
      where: {
        project: { agencyId: membership.agencyId },
        assigneeUserId: session.user.id,
        status: { notIn: ["CONCLUIDA", "CANCELADA"] },
      },
      include: { project: { include: { client: { select: { name: true } } } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.task.findMany({
      where: {
        project: { agencyId: membership.agencyId },
        status: "CONCLUIDA",
        completedAt: { gte: sixWeeksAgo },
      },
      select: { completedAt: true },
    }),
    prisma.client.count({ where: { agencyId: membership.agencyId, status: "ATIVO" } }),
    prisma.financeEntry.aggregate({
      where: { agencyId: membership.agencyId, type: "RECEITA", status: { in: ["PREVISTO", "PENDENTE", "VENCIDO"] } },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: { agencyId: membership.agencyId, type: "DESPESA", status: { in: ["PREVISTO", "PENDENTE", "VENCIDO"] } },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        agencyId: membership.agencyId,
        type: "RECEITA",
        status: "LIQUIDADO",
        settledDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        agencyId: membership.agencyId,
        type: "DESPESA",
        status: "LIQUIDADO",
        settledDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.findMany({
      where: {
        agencyId: membership.agencyId,
        type: "RECEITA",
        status: "LIQUIDADO",
        settledDate: { gte: sixMonthsAgo, lt: monthEnd },
      },
      select: { settledDate: true, amountCents: true },
    }),
    prisma.healthScoreSnapshot.findMany({
      where: { agencyId: membership.agencyId },
      orderBy: { createdAt: "desc" },
      select: { clientId: true, score: true },
    }),
  ]);

  const latestScoreByClientId = new Map<string, number>();
  for (const snapshot of latestHealthSnapshots) {
    if (!latestScoreByClientId.has(snapshot.clientId)) {
      latestScoreByClientId.set(snapshot.clientId, snapshot.score);
    }
  }
  const clientsAtRiskCount = Array.from(latestScoreByClientId.values()).filter(
    (score) => bandForScore(score) === "ALTO_RISCO",
  ).length;

  const aReceberAberto = aReceberAgg._sum.amountCents ?? 0;
  const aPagarAberto = aPagarAgg._sum.amountCents ?? 0;
  const recebidoMes = recebidoMesAgg._sum.amountCents ?? 0;
  const pagoMes = pagoMesAgg._sum.amountCents ?? 0;
  const saldoMes = recebidoMes - pagoMes;

  const revenueMonths: { label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    revenueMonths.push({ label: `${MONTH_LABELS_SHORT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, total: 0 });
  }
  for (const entry of revenueEntries) {
    if (!entry.settledDate) continue;
    const monthsAgo =
      (now.getUTCFullYear() - entry.settledDate.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - entry.settledDate.getUTCMonth());
    const index = 5 - monthsAgo;
    if (index >= 0 && index < revenueMonths.length) {
      revenueMonths[index]!.total += entry.amountCents;
    }
  }
  const maxRevenue = Math.max(1, ...revenueMonths.map((m) => m.total));

  const pendingRecurring = activeRecurring.filter(hasPendingGeneration);

  const attentionCards = [
    { label: "tarefa(s) atrasada(s)", count: overdueTasksCount, href: "/operacao" },
    { label: "aprovação(ões) de conteúdo pendente(s)", count: pendingApprovalsCount, href: "/conteudo/aprovacoes" },
    { label: "tarefa(s) sem responsável aguardando triagem", count: unassignedTasksCount, href: "/operacao" },
    { label: "férias/ausência(s) aguardando decisão", count: pendingLeavesCount, href: "/pessoas/ferias" },
    { label: "fatura(s) vencida(s)", count: overdueInvoicesCount, href: "/financeiro/visao-geral" },
    { label: "cliente(s) em alto risco (Health Score)", count: clientsAtRiskCount, href: "/clientes/carteira" },
  ];

  // Últimas 6 semanas, cada bucket é a segunda-feira daquela semana.
  const weekBuckets: { weekStart: Date; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weekBuckets.push({ weekStart: startOfWeekUTC(d), count: 0 });
  }
  for (const task of completedTasks) {
    if (!task.completedAt) continue;
    const bucketStart = startOfWeekUTC(task.completedAt).getTime();
    const bucket = weekBuckets.find((b) => b.weekStart.getTime() === bucketStart);
    if (bucket) bucket.count += 1;
  }
  const maxCount = Math.max(1, ...weekBuckets.map((b) => b.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">
            {greeting()}, {session.user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-[#667085]">Visão consolidada de {membership.agency.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pessoas/horas"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Apontar horas
          </Link>
          <Link
            href="/operacao"
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: "#6847F5" }}
          >
            Novo card
          </Link>
        </div>
      </div>

      {pendingRecurring.length > 0 && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-sm text-[#92600A]">
          <strong>{pendingRecurring.length}</strong> recorrência{pendingRecurring.length === 1 ? "" : "s"} com
          ocorrência ainda não gerada{pendingRecurring.length === 1 ? "" : "s"}:{" "}
          {pendingRecurring
            .slice(0, 3)
            .map((r) => `${r.title}${r.client ? ` (${r.client.name})` : ""}`)
            .join(", ")}
          {pendingRecurring.length > 3 ? "..." : ""} —{" "}
          <Link href="/operacao/recorrencias" className="font-semibold hover:underline">
            gerar agora
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/clientes/carteira"
          className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
        >
          <p className="text-2xl font-semibold text-[#101828]">{activeClientsCount}</p>
          <p className="text-xs text-[#667085]">clientes ativos</p>
        </Link>
        <Link
          href="/financeiro/receber"
          className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
        >
          <p className="text-2xl font-semibold text-[#166534]">{formatCents(aReceberAberto)}</p>
          <p className="text-xs text-[#667085]">a receber (em aberto)</p>
        </Link>
        <Link
          href="/financeiro/pagar"
          className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
        >
          <p className="text-2xl font-semibold text-[#B42318]">{formatCents(aPagarAberto)}</p>
          <p className="text-xs text-[#667085]">a pagar (em aberto)</p>
        </Link>
        <Link
          href="/financeiro/visao-geral"
          className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
        >
          <p className={`text-2xl font-semibold ${saldoMes >= 0 ? "text-[#166534]" : "text-[#B42318]"}`}>
            {formatCents(saldoMes)}
          </p>
          <p className="text-xs text-[#667085]">saldo do mês</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {attentionCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
          >
            <p
              className={`text-2xl font-semibold ${card.count > 0 ? "text-[#B42318]" : "text-[#101828]"}`}
            >
              {card.count}
            </p>
            <p className="text-xs text-[#667085]">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Minhas próximas tarefas</h2>
          {myTasks.length === 0 ? (
            <p className="text-sm text-[#98A2B3]">Nenhuma tarefa aberta atribuída a você.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {myTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[#101828]">{task.title}</p>
                    <p className="text-xs text-[#98A2B3]">
                      {task.project.client?.name ?? "Interna"} · {WORK_ITEM_STATUS_LABELS[task.status]}
                    </p>
                  </div>
                  {task.dueDate && (
                    <p className="text-xs text-[#667085]">{task.dueDate.toLocaleDateString("pt-BR")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#101828]">Recorrências ativas</h2>
            <Link href="/operacao/recorrencias" className="text-xs font-medium text-[#6847F5] hover:underline">
              Ver todas
            </Link>
          </div>
          {activeRecurring.length === 0 ? (
            <p className="text-sm text-[#98A2B3]">Nenhuma recorrência ativa ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activeRecurring.slice(0, 6).map((r) => (
                <Link
                  key={r.id}
                  href="/operacao/recorrencias"
                  className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2 hover:border-[#6847F5]"
                >
                  <span className="text-sm font-medium text-[#101828]">
                    {r.title}
                    {r.client ? ` (${r.client.name})` : ""}
                  </span>
                  {hasPendingGeneration(r) && (
                    <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92600A]">
                      pendente
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Tarefas concluídas por semana</h2>
          <div className="flex items-end gap-3" style={{ height: 96 }}>
            {weekBuckets.map((bucket) => (
              <div key={bucket.weekStart.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-[#6847F5]"
                  style={{ height: `${Math.max(4, (bucket.count / maxCount) * 72)}px` }}
                  title={`${bucket.count} concluída${bucket.count === 1 ? "" : "s"}`}
                />
                <p className="text-[10px] text-[#98A2B3]">
                  {bucket.weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
                </p>
                <p className="text-xs font-medium text-[#475467]">{bucket.count}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Receita recebida por mês</h2>
          <div className="flex items-end gap-3" style={{ height: 96 }}>
            {revenueMonths.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-[#16A36A]"
                  style={{ height: `${Math.max(4, (m.total / maxRevenue) * 72)}px` }}
                  title={formatCents(m.total)}
                />
                <p className="text-[10px] text-[#98A2B3]">{m.label}</p>
                <p className="text-xs font-medium text-[#475467]">{formatCents(m.total)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
