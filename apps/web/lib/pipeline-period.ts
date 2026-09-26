export type PipelinePeriod = "all" | "last30" | "last14" | "last7" | "year" | "month" | "custom";

export interface PipelinePeriodParams {
  period?: string;
  year?: string;
  month?: string;
  from?: string;
  to?: string;
}

export interface PipelinePeriodResult {
  period: PipelinePeriod;
  label: string;
  createdAt?: { gte?: Date; lt?: Date };
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nextUtcDay(date: Date) {
  const next = startOfUtcDay(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolvePipelinePeriod(params: PipelinePeriodParams, now = new Date()): PipelinePeriodResult {
  const today = startOfUtcDay(now);
  const period = (["all", "last30", "last14", "last7", "year", "month", "custom"] as const).includes(
    params.period as PipelinePeriod,
  )
    ? (params.period as PipelinePeriod)
    : "all";

  if (period === "all") return { period, label: "Todo o período" };

  if (period === "last30" || period === "last14" || period === "last7") {
    const days = period === "last30" ? 30 : period === "last14" ? 14 : 7;
    const gte = new Date(today);
    gte.setUTCDate(gte.getUTCDate() - days + 1);
    return { period, label: `Últimos ${days} dias`, createdAt: { gte, lt: nextUtcDay(today) } };
  }

  if (period === "year") {
    const year = Number(params.year);
    const validYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now.getUTCFullYear();
    return {
      period,
      label: `Ano de ${validYear}`,
      createdAt: { gte: new Date(Date.UTC(validYear, 0, 1)), lt: new Date(Date.UTC(validYear + 1, 0, 1)) },
    };
  }

  if (period === "month") {
    const match = params.month?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    const year = match ? Number(match[1]) : now.getUTCFullYear();
    const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
    const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    const start = new Date(Date.UTC(year, monthIndex, 1));
    return {
      period,
      label: formatter.format(start),
      createdAt: { gte: start, lt: new Date(Date.UTC(year, monthIndex + 1, 1)) },
    };
  }

  const from = parseDate(params.from);
  const to = parseDate(params.to);
  if (!from || !to || from > to) return { period: "all", label: "Todo o período" };
  return {
    period,
    label: `${from.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${to.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
    createdAt: { gte: from, lt: nextUtcDay(to) },
  };
}
