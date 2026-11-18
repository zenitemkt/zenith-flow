import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { nextAssistantWorkAt, processAssistantQueue } from "@/lib/assistant/process";
import { checkCronWake, refreshCronPlan } from "@/lib/cron-wake";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Chamado a cada minuto por um agendador externo, com `Authorization: Bearer ASSISTANT_CRON_SECRET`.
 * Só consulta o banco quando há trabalho (lib/cron-wake.ts) — deixa o Neon desligar quando ocioso.
 */
export async function GET(request: Request) {
  const expected = process.env.ASSISTANT_CRON_SECRET;
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : new URL(request.url).searchParams.get("key");
  if (!expected || !provided || !timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(provided).digest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wake = await checkCronWake("assistant");
  if (!wake.run) return NextResponse.json({ idle: true, nextDueAt: new Date(wake.nextDueAt).toISOString() });

  const stats = await processAssistantQueue();
  const nextDueAt = await refreshCronPlan("assistant", () => nextAssistantWorkAt());
  return NextResponse.json({ ...stats, wake: wake.reason, nextDueAt: nextDueAt ? new Date(nextDueAt).toISOString() : null });
}
