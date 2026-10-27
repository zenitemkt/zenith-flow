import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAssistantQueue } from "@/lib/assistant/process";

export const maxDuration = 60;

/** Chamado a cada minuto por um agendador externo, com `Authorization: Bearer ASSISTANT_CRON_SECRET`. */
export async function GET(request: Request) {
  const expected = process.env.ASSISTANT_CRON_SECRET;
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : new URL(request.url).searchParams.get("key");
  if (!expected || !provided || !timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(provided).digest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processAssistantQueue());
}
