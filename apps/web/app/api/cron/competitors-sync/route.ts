import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { syncAllCompetitors } from "@/lib/competitors";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Atualização diária dos concorrentes (perfil, posts e foto do dia). Protegida por CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json(await syncAllCompetitors());
}
