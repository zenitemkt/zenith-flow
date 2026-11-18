import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { nextSocialPostWorkAt, publishDueSocialPosts } from "@/lib/social-publisher";
import { nextFlowSessionWorkAt, processDueFlowSessions } from "@/lib/instagram-flow";
import { checkCronWake, refreshCronPlan } from "@/lib/cron-wake";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Chamado a cada minuto por um agendador externo (cron-job.org) — o plano
 * Hobby da Vercel só roda cron 1x/dia. Protegido por `CRON_SECRET` no header
 * `Authorization: Bearer <segredo>` (mesmo formato que a Vercel Cron usa).
 *
 * Sem esse agendador externo configurado, NADA chama esta rota (foi o que
 * aconteceu até 2026-11-12: agendados não saíam). A rede de segurança é o
 * sistema aberto no navegador (`/api/social/publish-due`), que não cobre
 * horários em que ninguém está com o sistema aberto.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  // Sem trabalho pendente, nem toca no banco (deixa o Neon desligar) — ver lib/cron-wake.ts.
  const wake = await checkCronWake("social");
  if (!wake.run) return NextResponse.json({ ok: true, idle: true, nextDueAt: new Date(wake.nextDueAt).toISOString() });

  // Mesmo cron de minuto em minuto retoma as sequências do mini-chat de Instagram (atrasos e perguntas sem resposta).
  const started = Date.now();
  const flows = await processDueFlowSessions(12_000).catch((error) => ({ error: error instanceof Error ? error.message : "falha" }));
  const summary = await publishDueSocialPosts(Math.max(20_000, 50_000 - (Date.now() - started)));
  // Se as sequências falharam, não grava plano: o próximo minuto tenta de novo.
  const nextDueAt =
    "error" in flows ? null : await refreshCronPlan("social", async () => [...(await nextSocialPostWorkAt()), ...(await nextFlowSessionWorkAt())]);
  return NextResponse.json({ ok: true, ...summary, instagramFlows: flows, wake: wake.reason, nextDueAt: nextDueAt ? new Date(nextDueAt).toISOString() : null });
}

export const GET = handle;
export const POST = handle;
