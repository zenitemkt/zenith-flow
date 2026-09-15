import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, Sparkles, Target, Users, Wallet } from "lucide-react";
import { requireSessionAndMembership } from "@/lib/session";
import { hasPendingGeneration } from "@/lib/recurring-tasks";
import { startOfWeekUTC } from "@/lib/timesheets";
import { WORK_ITEM_STATUS_LABELS } from "@/lib/tasks";
import { formatCents } from "@/lib/finance";
import { startOfDayUTC } from "@/lib/dates";
import { getXrayDashboard } from "@/lib/dashboard-xray";
import { DonutChart } from "@/app/_components/charts/DonutChart";
import { BarsChart } from "@/app/_components/charts/BarsChart";
import { TrendAreaChart } from "@/app/_components/charts/TrendAreaChart";
import { KpiCard, AttentionList, MiniPanel, type AttentionItem, type Tone } from "@zenith/ui";
import { AskAiButton } from "@/app/_components/AskAiButton";
import { prisma } from "@zenith/db";

const COCKPIT_BAR_COLORS = ["#FF2B00", "#168F9D", "#316FDC"];

const TASK_STATUS_STYLES: Record<string, string> = {
  BACKLOG: "text-[#667085]",
  PLANEJADA: "text-[#2859B8]",
  EM_ANDAMENTO: "text-[#B45309]",
  BLOQUEADA: "text-[#A11D1D]",
  REVISAO: "text-[#6D28D9]",
  CONCLUIDA: "text-[#0B6B43]",
  CANCELADA: "text-[#98A2B3]",
};

function ThemeHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mt-2 border-t border-[#E4E7EC] pt-6">
      <span className="mb-2 inline-flex items-center rounded-full bg-[#FFF1EC] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#FF2B00]">
        Raio-x Zenith
      </span>
      <h2 className="text-lg font-semibold text-[#101828]">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 className="mb-3 text-sm font-semibold text-[#101828]">{title}</h3>
      {children}
    </section>
  );
}

function StatCard({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-2xl font-semibold text-[#101828]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[#475467]">{label}</p>
    </div>
  );
}

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
  const todayStart = startOfDayUTC(now);

  const [
    activeRecurring,
    pendingApprovalsCount,
    pendingLeavesCount,
    overdueInvoicesCount,
    myTasks,
    completedTasks,
    activeClientsCount,
    aReceberAgg,
    aPagarAgg,
    recebidoMesAgg,
    pagoMesAgg,
    xray,
  ] = await Promise.all([
    prisma.recurringTaskTemplate.findMany({
      where: { agencyId: membership.agencyId, status: "ATIVO" },
      include: { generations: { select: { period: true } }, dates: { select: { date: true } }, client: { select: { name: true } } },
    }),
    prisma.contentApproval.count({
      where: { status: "PENDENTE", contentVersion: { contentItem: { agencyId: membership.agencyId } } },
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
    getXrayDashboard(membership.agencyId),
  ]);

  const clientsAtRiskCount = xray.clientes.healthScoreData.find((d) => d.name === "Alto risco")?.value ?? 0;

  const aReceberAberto = aReceberAgg._sum.amountCents ?? 0;
  const aPagarAberto = aPagarAgg._sum.amountCents ?? 0;
  const recebidoMes = recebidoMesAgg._sum.amountCents ?? 0;
  const pagoMes = pagoMesAgg._sum.amountCents ?? 0;
  const saldoMes = recebidoMes - pagoMes;

  const pendingRecurring = activeRecurring.filter(hasPendingGeneration);

  const attentionCards: { label: string; count: number; href: string; badge: string; tone: Tone }[] = [
    {
      label: "aprovação(ões) de conteúdo pendente(s)",
      count: pendingApprovalsCount,
      href: "/operacao",
      badge: "Operação",
      tone: "warn",
    },
    {
      label: "férias/ausência(s) aguardando decisão",
      count: pendingLeavesCount,
      href: "/pessoas/ferias",
      badge: "Pessoas",
      tone: "default",
    },
    {
      label: "fatura(s) vencida(s)",
      count: overdueInvoicesCount,
      href: "/financeiro/visao-geral",
      badge: "Financeiro",
      tone: "danger",
    },
    {
      label: "cliente(s) em alto risco (Health Score)",
      count: clientsAtRiskCount,
      href: "/clientes/carteira",
      badge: "Clientes",
      tone: "danger",
    },
  ];

  const attentionItems: AttentionItem[] = attentionCards
    .filter((card) => card.count > 0)
    .map((card) => ({
      key: card.label,
      title: `${card.count} ${card.label}`,
      meta: "Clique para ver os registros que formam esse número.",
      badge: card.badge,
      tone: card.tone,
      href: card.href,
    }));

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
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[20px] border border-[#E4E7EC] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="mb-2 inline-flex items-center rounded-full bg-[#FFF1EC] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#FF2B00]">
              Visão geral
            </span>
            <h1 className="text-2xl font-semibold tracking-normal text-[#101828]">
              {greeting()}, {session.user.name.split(" ")[0]}!
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#667085]">
              Visão consolidada de {membership.agency.name}: operação, dinheiro, risco, clientes e próximas ações.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pessoas/horas"
              className="rounded-[10px] border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
            >
              Apontar horas
            </Link>
            <Link
              href="/operacao"
              className="rounded-[10px] bg-[#FF2B00] px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,43,0,0.24)] hover:bg-[#E02600]"
            >
              Nova tarefa
            </Link>
            <AskAiButton />
          </div>
        </div>
      </div>

      {pendingRecurring.length > 0 && (
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-sm text-[#92600A]">
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

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#101828]">Destaques</h2>
          <span className="text-xs text-[#98A2B3]">Atualizado agora</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Users size={18} aria-hidden />}
            label="Clientes ativos"
            value={String(activeClientsCount)}
            trend={clientsAtRiskCount > 0 ? `${clientsAtRiskCount} em alto risco` : "Nenhum em alto risco"}
            tone={clientsAtRiskCount > 0 ? "warn" : "success"}
            href="/clientes/carteira"
            linkComponent={Link}
          />
          <KpiCard
            icon={<Wallet size={18} aria-hidden />}
            label="A receber (em aberto)"
            value={formatCents(aReceberAberto)}
            trend={overdueInvoicesCount > 0 ? `${overdueInvoicesCount} fatura(s) vencida(s)` : "Nenhuma vencida"}
            tone={overdueInvoicesCount > 0 ? "danger" : "success"}
            href="/financeiro/receber"
            linkComponent={Link}
          />
          <KpiCard
            icon={<Landmark size={18} aria-hidden />}
            label="A pagar (em aberto)"
            value={formatCents(aPagarAberto)}
            trend="Vencimentos da agência"
            href="/financeiro/pagar"
            linkComponent={Link}
          />
          <KpiCard
            icon={<Target size={18} aria-hidden />}
            label="Saldo do mês"
            value={formatCents(saldoMes)}
            trend={saldoMes >= 0 ? "Recebido menos pago, positivo" : "Recebido menos pago, negativo"}
            tone={saldoMes >= 0 ? "success" : "danger"}
            href="/financeiro/visao-geral"
            linkComponent={Link}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="rounded-[20px] border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#101828]">Receita realizada — 6 meses</h2>
            <span className="text-xs text-[#667085]">Competência</span>
          </div>
          <TrendAreaChart data={xray.financeiro.cashflowMonths} dataKey="realizado" format="cents" color="#FF2B00" />
        </section>
        <section className="rounded-[20px] border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#101828]">Precisa de atenção</h2>
            <span className="text-xs text-[#667085]">Drill-down em 1 clique</span>
          </div>
          <AttentionList items={attentionItems} linkComponent={Link} emptyLabel="Nada pedindo atenção agora." />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MiniPanel
          icon={<Wallet size={15} aria-hidden />}
          title="Financeiro"
          ctaLabel="Abrir régua"
          href="/financeiro/cobrancas"
          linkComponent={Link}
        >
          DSO em {xray.financeiro.dso === null ? "—" : `${xray.financeiro.dso} dias`}
          {overdueInvoicesCount > 0 ? `, ${overdueInvoicesCount} fatura(s) vencida(s)` : ", nenhuma fatura vencida"}.
        </MiniPanel>
        <MiniPanel
          icon={<Target size={15} aria-hidden />}
          title="Comercial"
          ctaLabel="Ver funil"
          href="/comercial/pipeline"
          linkComponent={Link}
        >
          {xray.comercial.totalLeads} lead(s) nos últimos 6 meses
          {xray.comercial.conversionRate !== null ? `, ${xray.comercial.conversionRate}% de conversão` : ""}.
        </MiniPanel>
        <MiniPanel
          icon={<Sparkles size={15} aria-hidden />}
          title="Zenith AI"
          ctaLabel="Saber mais"
          href="/zenith-ai"
          linkComponent={Link}
        >
          Assistente de IA ainda não habilitado para esta agência.
        </MiniPanel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="rounded-[20px] border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Minhas próximas tarefas</h2>
          {myTasks.length === 0 ? (
            <p className="text-sm text-[#98A2B3]">Nenhuma tarefa aberta atribuída a você.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#EEF0F3] text-left text-xs text-[#98A2B3]">
                    <th className="pb-2 pr-3 font-medium">Tarefa</th>
                    <th className="pb-2 pr-3 font-medium">Cliente</th>
                    <th className="pb-2 pr-3 font-medium">Prazo</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myTasks.map((task) => (
                    <tr key={task.id} className="border-b border-[#F2F4F7] last:border-0 hover:bg-[#FFF9F7]">
                      <td className="py-2.5 pr-3 font-medium text-[#101828]">{task.title}</td>
                      <td className="py-2.5 pr-3 text-[#667085]">{task.project.client?.name ?? "Interna"}</td>
                      <td className="py-2.5 pr-3 text-[#667085]">
                        {task.dueDate ? task.dueDate.toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className={`py-2.5 font-medium ${TASK_STATUS_STYLES[task.status] ?? "text-[#667085]"}`}>
                        {WORK_ITEM_STATUS_LABELS[task.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[20px] border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#101828]">Recorrências ativas</h2>
            <Link href="/operacao/recorrencias" className="text-xs font-medium text-[#FF2B00] hover:underline">
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
                  className="flex items-center justify-between rounded-xl border border-[#EEF0F3] px-3 py-2 transition-colors hover:border-[#FF2B00]/50 hover:bg-[#FFF9F7]"
                >
                  <span className="truncate text-sm font-medium text-[#101828]">
                    {r.title}
                    {r.client ? ` (${r.client.name})` : ""}
                  </span>
                  {hasPendingGeneration(r) && (
                    <span className="ml-2 shrink-0 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92600A]">
                      pendente
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tema: Financeiro                                                  */}
      {/* ---------------------------------------------------------------- */}
      <ThemeHeader title="Financeiro" subtitle="Caixa, inadimplência e para onde vai o dinheiro." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          value={xray.financeiro.dso === null ? "—" : `${xray.financeiro.dso} dias`}
          label="DSO — dias para receber"
        />
        <StatCard
          value={xray.financeiro.logoChurn === null ? "—" : `${xray.financeiro.logoChurn}%`}
          label="Logo churn (90 dias)"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Receita: previsto × realizado (6 meses)">
          <BarsChart
            data={xray.financeiro.cashflowMonths}
            series={[
              { key: "previsto", label: "Previsto", color: "#98A2B3" },
              { key: "realizado", label: "Realizado", color: "#16A36A" },
            ]}
            format="cents"
          />
        </ChartCard>
        <ChartCard title="Contas a receber por estágio da régua">
          <DonutChart data={xray.financeiro.collectionLadderData} format="cents" centerLabel="Total" />
        </ChartCard>
        <ChartCard title="Despesas do mês por categoria">
          <DonutChart data={xray.financeiro.expenseByCategoryData} format="cents" centerLabel="Total" />
        </ChartCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tema: Clientes & Saúde da carteira                                */}
      {/* ---------------------------------------------------------------- */}
      <ThemeHeader title="Clientes & saúde da carteira" subtitle="Onde estão os riscos antes de virarem cancelamento." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Clientes por status">
          <DonutChart data={xray.clientes.clientStatusData} centerLabel="Clientes" />
        </ChartCard>
        <ChartCard title="Health Score — distribuição">
          <DonutChart data={xray.clientes.healthScoreData} centerLabel="Clientes" />
        </ChartCard>
        <ChartCard title="Risco de churn — distribuição">
          <DonutChart data={xray.clientes.churnRiskData} centerLabel="Clientes" />
        </ChartCard>
      </div>
      {xray.clientes.nps && (
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-2xl font-semibold text-[#101828]">{xray.clientes.nps.score}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">
            NPS mais recente — campanha &quot;{xray.clientes.nps.campaignName}&quot;
          </p>
          <p className="mt-1 text-xs text-[#98A2B3]">
            Calculado em {xray.clientes.nps.computedAt.toLocaleDateString("pt-BR")}.{" "}
            <Link href="/clientes/nps" className="font-medium text-[#FF2B00] hover:underline">
              Ver NPS
            </Link>
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Tema: Comercial                                                   */}
      {/* ---------------------------------------------------------------- */}
      <ThemeHeader title="Comercial" subtitle="Funil de vendas, de lead a proposta fechada." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard value={xray.comercial.totalLeads} label="Leads nos últimos 6 meses" />
        <StatCard
          value={xray.comercial.conversionRate === null ? "—" : `${xray.comercial.conversionRate}%`}
          label="Taxa de conversão lead → cliente"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Pipeline — oportunidades abertas por estágio">
          <BarsChart
            data={xray.comercial.pipelineFunnelData}
            series={[{ key: "quantidade", label: "Oportunidades", color: "#FF2B00" }]}
            layout="vertical"
          />
        </ChartCard>
        <ChartCard title="Propostas por status">
          <DonutChart data={xray.comercial.proposalStatusData} centerLabel="Propostas" />
        </ChartCard>
        <ChartCard title="Leads novos por mês">
          <BarsChart
            data={xray.comercial.leadsByMonth}
            series={[{ key: "leads", label: "Leads", color: "#3B82F6" }]}
          />
        </ChartCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tema: Operação & Produtividade                                    */}
      {/* ---------------------------------------------------------------- */}
      <ThemeHeader title="Operação & produtividade" subtitle="O que está em andamento e quem está com mais carga." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Tarefas concluídas por semana">
          <BarsChart
            data={weekBuckets.map((b) => ({
              label: b.weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
              concluidas: b.count,
            }))}
            series={[{ key: "concluidas", label: "Concluídas", color: "#FF2B00" }]}
          />
        </ChartCard>
        <ChartCard title="Tarefas abertas por status">
          <DonutChart data={xray.operacao.taskStatusData} centerLabel="Tarefas" />
        </ChartCard>
        <ChartCard title="Carga por pessoa (tarefas abertas)">
          <BarsChart
            data={xray.operacao.workloadData}
            series={[{ key: "tarefas", label: "Tarefas", color: "#F59E0B" }]}
            layout="vertical"
          />
        </ChartCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tema: Pessoas                                                     */}
      {/* ---------------------------------------------------------------- */}
      <ThemeHeader title="Pessoas" subtitle="Time, carga de horas e clima interno." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Colaboradores por status">
          <DonutChart data={xray.pessoas.employeeStatusData} centerLabel="Pessoas" />
        </ChartCard>
        <ChartCard title="Horas apontadas esta semana, por pessoa">
          <BarsChart
            data={xray.pessoas.hoursData}
            series={[{ key: "horas", label: "Horas", color: "#14B8A6" }]}
            layout="vertical"
          />
        </ChartCard>
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {xray.pessoas.enps ? (
            <>
              <p className="text-2xl font-semibold text-[#101828]">{xray.pessoas.enps.score}</p>
              <p className="mt-1 text-xs font-medium text-[#475467]">
                eNPS mais recente — campanha &quot;{xray.pessoas.enps.campaignName}&quot;
              </p>
              <p className="mt-1 text-xs text-[#98A2B3]">
                Calculado em {xray.pessoas.enps.computedAt.toLocaleDateString("pt-BR")}.{" "}
                <Link href="/pessoas/enps" className="font-medium text-[#FF2B00] hover:underline">
                  Ver eNPS
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold text-[#101828]">—</p>
              <p className="mt-1 text-xs font-medium text-[#475467]">eNPS ainda não calculado</p>
              <Link href="/pessoas/enps" className="mt-1 inline-block text-xs font-medium text-[#FF2B00] hover:underline">
                Criar campanha
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tema: Conteúdo                                                    */}
      {/* ---------------------------------------------------------------- */}
      <ThemeHeader title="Conteúdo" subtitle="Peças em produção e aprovação, de ponta a ponta." />
      <ChartCard title="Peças de conteúdo por status">
        <DonutChart data={xray.conteudo.contentStatusData} centerLabel="Peças" />
      </ChartCard>
    </div>
  );
}
