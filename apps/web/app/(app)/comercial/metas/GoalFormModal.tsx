"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import type { GoalMetric, GoalPeriod } from "@zenite-mkt/db";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import {
  GOAL_METRICS,
  GOAL_METRIC_BY_ID,
  GOAL_PERIOD_LABELS,
  goalTargetInput,
  monthParam,
  parseGoalTarget,
} from "@/lib/goal-periods";

const QUARTERS = ["1º tri (jan–mar)", "2º tri (abr–jun)", "3º tri (jul–set)", "4º tri (out–dez)"];

const selectClass =
  "h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";

/** Criar meta: escolhe o que medir, mensal/trimestral, o período e o valor alvo. */
export function NewGoalButton({ defaultYear, defaultMonth }: { defaultYear: number; defaultMonth: number }) {
  const router = useRouter();
  const guardSubmit = useSubmitGuard();
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<GoalMetric>("REVENUE");
  const [period, setPeriod] = useState<GoalPeriod>("MONTHLY");
  const [monthValue, setMonthValue] = useState(monthParam(defaultYear, defaultMonth));
  const [quarterYear, setQuarterYear] = useState(defaultYear);
  const [quarter, setQuarter] = useState(Math.floor(defaultMonth / 3));
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const info = GOAL_METRIC_BY_ID[metric];

  function close() {
    if (loading) return;
    setTarget("");
    setTitle("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      const parsedTarget = parseGoalTarget(target, info.money);
      if (!parsedTarget) {
        setError(info.money ? "Informe o valor em reais, ex.: 30.000" : "Informe um número inteiro maior que zero.");
        return;
      }
      const [y, m] = monthValue.split("-").map(Number);
      const year = period === "MONTHLY" ? y! : quarterYear;
      const month = period === "MONTHLY" ? m! - 1 : quarter * 3;

      setLoading(true);
      try {
        const res = await fetch("/api/commercial-goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metric, period, year, month, target: parsedTarget, title }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? "Não foi possível criar a meta.");
          return;
        }
        setLoading(false);
        close();
        router.refresh();
      } finally {
        setLoading(false);
      }
    });
  }

  const years = [defaultYear - 1, defaultYear, defaultYear + 1];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        <Plus size={16} aria-hidden /> Nova meta
      </button>
      <Modal open={open} onClose={close} title="Nova meta" description="O realizado é calculado sozinho a partir dos dados do sistema.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={loading}>
          <fieldset disabled={loading} className="flex min-w-0 flex-col gap-4 border-0 p-0">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#344054]">O que medir</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GOAL_METRICS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetric(m.id)}
                    aria-pressed={metric === m.id}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      metric === m.id ? "border-[#FF2B00] bg-[#FFF7F5] font-semibold text-[#101828]" : "border-[#E4E7EC] text-[#475467] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#667085]">{info.description}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#344054]">Período</span>
              <div className="flex gap-2">
                {(Object.keys(GOAL_PERIOD_LABELS) as GoalPeriod[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    aria-pressed={period === p}
                    className={`flex h-10 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${
                      period === p ? "bg-[#101828] text-white" : "border border-[#D0D5DD] text-[#344054]"
                    }`}
                  >
                    {GOAL_PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
              {period === "MONTHLY" ? (
                <input
                  type="month"
                  required
                  value={monthValue}
                  onChange={(e) => setMonthValue(e.target.value)}
                  aria-label="Mês da meta"
                  className={selectClass}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} aria-label="Trimestre" className={selectClass}>
                    {QUARTERS.map((label, i) => (
                      <option key={label} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select value={quarterYear} onChange={(e) => setQuarterYear(Number(e.target.value))} aria-label="Ano" className={selectClass}>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <FormField
              label={info.money ? "Meta (R$)" : "Meta (quantidade)"}
              name="target"
              inputMode={info.money ? "decimal" : "numeric"}
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={info.money ? "30.000" : "20"}
            />
            <FormField
              label="Nome (opcional)"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${info.label} ${GOAL_PERIOD_LABELS[period].toLowerCase()}`}
            />
          </fieldset>

          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={loading} className="flex h-10 items-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB] disabled:opacity-60">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              {loading ? "Criando..." : "Criar meta"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Editar valor/nome ou excluir uma meta existente. */
export function GoalActions({
  goalId,
  metric,
  target,
  title,
}: {
  goalId: string;
  metric: GoalMetric;
  target: number;
  title: string | null;
}) {
  const router = useRouter();
  const info = GOAL_METRIC_BY_ID[metric];
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(goalTargetInput(target, info.money));
  const [name, setName] = useState(title ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseGoalTarget(value, info.money);
    if (!parsed) {
      setError(info.money ? "Informe o valor em reais, ex.: 30.000" : "Informe um número inteiro maior que zero.");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/commercial-goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: parsed, title: name }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Excluir esta meta? O histórico dela deixa de aparecer.")) return;
    setLoading(true);
    const res = await fetch(`/api/commercial-goals/${goalId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      setError("Não foi possível excluir.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar meta"
        title="Editar meta"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7] hover:text-[#101828]"
      >
        <Pencil size={15} aria-hidden />
      </button>
      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Editar meta" description={info.label}>
        <form onSubmit={save} className="flex flex-col gap-3">
          <FormField
            label={info.money ? "Meta (R$)" : "Meta (quantidade)"}
            name="target"
            inputMode={info.money ? "decimal" : "numeric"}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <FormField label="Nome (opcional)" name="title" value={name} onChange={(e) => setName(e.target.value)} />
          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={loading}
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60"
            >
              <Trash2 size={15} aria-hidden /> Excluir
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
