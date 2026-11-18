import { getCache } from "@vercel/functions";

/**
 * "Acordador" dos crons de minuto em minuto (2026-11-18).
 *
 * O cron-job.org chama /api/cron/social-publish e /api/assistant/process a cada
 * minuto. Se cada chamada consultasse o banco, o Neon nunca chegaria aos 5 min
 * ociosos que precisa para desligar (scale-to-zero), e o plano Free estoura
 * (~180 CU-h/mês contra 100). Então cada cron guarda no Runtime Cache da Vercel
 * QUANDO é o próximo trabalho e só toca no banco quando:
 *  - não há plano no cache (primeira vez, expirou, foi despejado ou o cache falhou);
 *  - alguma tabela da fila foi escrita depois do último cálculo ("touched");
 *  - chegou a hora do próximo trabalho;
 *  - virou a hora cheia (rede de segurança para limpezas — os dois crons
 *    acordam juntos, no mesmo minuto, e dividem a mesma "acordada" do banco).
 *
 * O cache é só atalho: na dúvida (erro, ausência), roda como antes.
 */
export type CronJob = "social" | "assistant";

/** Tabelas cujas escritas podem criar trabalho para cada cron. */
export const CRON_JOB_MODELS: Record<CronJob, readonly string[]> = {
  social: ["SocialPost", "InstagramFlowSession"],
  assistant: ["AssistantConversation", "AssistantBooking", "AssistantSettings"],
};

export interface CronPlan {
  /** Epoch ms do próximo trabalho conhecido (já limitado à próxima hora cheia). */
  nextDueAt: number;
  /** Epoch ms de quando o banco foi consultado para calcular o plano. */
  computedAt: number;
}

/**
 * Folga para escritas "em voo": dentro de uma $transaction o aviso sai antes do
 * COMMIT, e relógios de instâncias diferentes podem divergir um pouco.
 */
export const TOUCH_SKEW_MS = 15_000;
const HOUR_MS = 60 * 60_000;
const ENTRY_TTL_SECONDS = 2 * 60 * 60;

export type WakeDecision = { run: true; reason: "no-plan" | "touched" | "due" } | { run: false; nextDueAt: number };

/** Decide se o cron precisa consultar o banco agora. Função pura (testada). */
export function decideCronRun(now: number, plan: CronPlan | null, touchedAt: number | null): WakeDecision {
  if (!plan) return { run: true, reason: "no-plan" };
  if (touchedAt !== null && touchedAt >= plan.computedAt - TOUCH_SKEW_MS) return { run: true, reason: "touched" };
  if (now >= plan.nextDueAt) return { run: true, reason: "due" };
  return { run: false, nextDueAt: plan.nextDueAt };
}

/** Próxima hora cheia estritamente depois de `now` (UTC — igual para os dois crons). */
export function nextHourBoundary(now: number): number {
  return Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
}

/** Junta os candidatos (null = nenhum) e limita à próxima hora cheia. */
export function planNextDueAt(now: number, candidates: Array<Date | number | null | undefined>): number {
  let next = nextHourBoundary(now);
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const at = typeof candidate === "number" ? candidate : candidate.getTime();
    if (Number.isFinite(at) && at < next) next = at;
  }
  return next;
}

function isPlan(value: unknown): value is CronPlan {
  const v = value as Partial<CronPlan> | null;
  return !!v && typeof v.nextDueAt === "number" && typeof v.computedAt === "number";
}

const planKey = (job: CronJob) => `cron-wake:${job}:plan`;
const touchedKey = (job: CronJob) => `cron-wake:${job}:touched`;

function cache() {
  return getCache({ namespace: "zenite" });
}

/** Lê plano + último "touch". Qualquer erro vira "roda" (fail-open). */
export async function checkCronWake(job: CronJob, now = Date.now()): Promise<WakeDecision> {
  try {
    const c = cache();
    const [plan, touched] = await Promise.all([c.get(planKey(job)), c.get(touchedKey(job))]);
    return decideCronRun(now, isPlan(plan) ? plan : null, typeof touched === "number" ? touched : null);
  } catch (error) {
    console.error("cron_wake_check_failed", job, error);
    return { run: true, reason: "no-plan" };
  }
}

/** Grava o plano calculado no fim de uma rodada bem-sucedida. */
export async function saveCronPlan(job: CronJob, plan: CronPlan): Promise<void> {
  try {
    await cache().set(planKey(job), plan, { ttl: ENTRY_TTL_SECONDS, name: `cron-wake-${job}-plan` });
  } catch (error) {
    console.error("cron_wake_save_failed", job, error);
  }
}

/**
 * Fim de uma rodada bem-sucedida: consulta o banco pelo próximo trabalho e grava o plano.
 * `computedAt` é tirado ANTES da consulta, para que escritas concorrentes contem como "touched".
 * Se a consulta falhar, não grava nada (o próximo minuto roda de novo).
 */
export async function refreshCronPlan(job: CronJob, compute: () => Promise<Array<Date | null | undefined>>): Promise<number | null> {
  const computedAt = Date.now();
  try {
    const nextDueAt = planNextDueAt(computedAt, await compute());
    await saveCronPlan(job, { nextDueAt, computedAt });
    return nextDueAt;
  } catch (error) {
    console.error("cron_wake_plan_failed", job, error);
    return null;
  }
}

/** Marca que a fila do job mudou: o próximo minuto do cron consulta o banco. */
export async function touchCronJob(job: CronJob, now = Date.now()): Promise<void> {
  await cache().set(touchedKey(job), now, { ttl: ENTRY_TTL_SECONDS, name: `cron-wake-${job}-touched` });
}

/** Ouvinte registrado no Prisma (instrumentation.ts): escrita numa tabela de fila → touch do job. */
export async function onModelWrite(model: string): Promise<void> {
  for (const job of Object.keys(CRON_JOB_MODELS) as CronJob[]) {
    if (CRON_JOB_MODELS[job].includes(model)) await touchCronJob(job);
  }
}
