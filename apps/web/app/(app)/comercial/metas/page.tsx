import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { computeGoalProgress, type GoalPace, type GoalProgress } from "@/lib/commercial-goals";
import {
  GOAL_METRIC_BY_ID,
  GOAL_PERIOD_LABELS,
  formatGoalValue,
  monthParam,
  monthStart,
  monthTitle,
  parseMonthParam,
  periodLabel,
  periodStartFor,
  spYearMonth,
} from "@/lib/goal-periods";
import { GoalRing } from "./GoalRing";
import { GoalActions, NewGoalButton } from "./GoalFormModal";

const PACE: Record<GoalPace, { label: string; color: string; badge: string }> = {
  achieved: { label: "Meta batida", color: "#16A36A", badge: "bg-[#DCFCE7] text-[#166534]" },
  on_track: { label: "No ritmo", color: "#2E90FA", badge: "bg-[#EEF4FF] text-[#2859B8]" },
  behind: { label: "Atrasada", color: "#F79009", badge: "bg-[#FEF3C7] text-[#92600A]" },
  missed: { label: "Não atingida", color: "#D94343", badge: "bg-[#FEE4E2] text-[#B42318]" },
  upcoming: { label: "Ainda não começou", color: "#98A2B3", badge: "bg-[#F2F4F7] text-[#475467]" },
};

function GoalCard({ progress, canManage }: { progress: GoalProgress; canManage: boolean }) {
  const { goal, actual, percent, pace, remaining, perDayNeeded, daysLeft, elapsed } = progress;
  const info = GOAL_METRIC_BY_ID[goal.metric];
  const style = PACE[pace];

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[#EEF0F3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
            {GOAL_PERIOD_LABELS[goal.period]} · {periodLabel(goal.period, goal.periodStart)}
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold text-[#101828]">{goal.title ?? info.label}</h3>
          {goal.title && <p className="text-xs text-[#667085]">{info.label}</p>}
        </div>
        {canManage && <GoalActions goalId={goal.id} metric={goal.metric} target={goal.target} title={goal.title} />}
      </div>

      <div className="flex items-center gap-5">
        <GoalRing percent={percent} color={style.color} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>{style.label}</span>
          <p className="text-xl font-bold leading-tight text-[#101828]">{formatGoalValue(actual, info.money)}</p>
          <p className="text-xs text-[#667085]">de {formatGoalValue(goal.target, info.money)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-[#EEF0F3] pt-3 text-xs text-[#667085]">
        {pace === "achieved" ? (
          <p>
            Passou da meta em <strong className="text-[#101828]">{formatGoalValue(actual - goal.target, info.money)}</strong>.
          </p>
        ) : pace === "missed" ? (
          <p>
            Faltaram <strong className="text-[#101828]">{formatGoalValue(remaining, info.money)}</strong>.
          </p>
        ) : pace === "upcoming" ? (
          <p>Começa em {periodLabel(goal.period, goal.periodStart)}.</p>
        ) : (
          <>
            <p>
              Faltam <strong className="text-[#101828]">{formatGoalValue(remaining, info.money)}</strong> · {daysLeft} dia
              {daysLeft === 1 ? "" : "s"} restante{daysLeft === 1 ? "" : "s"}
            </p>
            {perDayNeeded !== null && (
              <p>
                Ritmo necessário: <strong className="text-[#101828]">{formatGoalValue(Math.ceil(perDayNeeded), info.money)}/dia</strong>
                {info.cumulative ? ` · ${Math.round(elapsed * 100)}% do período já passou` : ""}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export default async function MetasPage({ searchParams }: { searchParams: { mes?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  const now = new Date();
  const { year, month } = parseMonthParam(searchParams.mes, now);
  const current = spYearMonth(now);
  const isCurrentMonth = year === current.year && month === current.month;

  // Metas que valem neste mês: a mensal dele e a trimestral do trimestre que o contém.
  const goals = await prisma.commercialGoal.findMany({
    where: {
      agencyId: membership.agencyId,
      OR: [
        { period: "MONTHLY", periodStart: periodStartFor("MONTHLY", year, month) },
        { period: "QUARTERLY", periodStart: periodStartFor("QUARTERLY", year, month) },
      ],
    },
    orderBy: [{ period: "asc" }, { createdAt: "asc" }],
  });
  const progress = await Promise.all(goals.map((goal) => computeGoalProgress(goal, now)));

  const prev = spYearMonth(monthStart(year, month - 1));
  const next = spYearMonth(monthStart(year, month + 1));
  const canManage = canManageTeam(membership.role);
  const achieved = progress.filter((p) => p.pace === "achieved").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-[#0B0B0F] px-6 py-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold !text-white">Metas comerciais</h1>
          <p className="mt-1 text-sm text-white/60">Definidas por vocês, acompanhadas sozinhas com os dados do sistema.</p>
        </div>
        {progress.length > 0 && (
          <div className="rounded-xl bg-white/5 px-4 py-2 text-center text-white">
            <p className="text-lg font-bold leading-none">
              {achieved}/{progress.length}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/60">batidas</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/comercial/metas?mes=${monthParam(prev.year, prev.month)}`}
            aria-label="Mês anterior"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
          >
            <ChevronLeft size={18} aria-hidden />
          </Link>
          <span className="min-w-[160px] px-2 text-center text-sm font-semibold text-[#101828]">{monthTitle(year, month)}</span>
          <Link
            href={`/comercial/metas?mes=${monthParam(next.year, next.month)}`}
            aria-label="Próximo mês"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
          >
            <ChevronRight size={18} aria-hidden />
          </Link>
          {!isCurrentMonth && (
            <Link href="/comercial/metas" className="ml-2 text-sm font-medium text-[#667085] hover:text-[#101828]">
              Ir para o mês atual
            </Link>
          )}
        </div>
        {canManage && <NewGoalButton defaultYear={year} defaultMonth={month} />}
      </div>

      {progress.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <Target size={28} className="text-[#98A2B3]" aria-hidden />
          <p className="text-sm font-medium text-[#101828]">Nenhuma meta para {monthTitle(year, month).toLowerCase()}.</p>
          <p className="max-w-md text-sm text-[#667085]">
            Crie metas mensais ou trimestrais, como clientes ativos, faturamento ou vendas fechadas. O progresso é calculado sozinho.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {progress.map((p) => (
            <GoalCard key={p.goal.id} progress={p} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
