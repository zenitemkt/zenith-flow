import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncAllGooglePlaces } from "@/lib/google-places";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json(await syncAllGooglePlaces());
}
