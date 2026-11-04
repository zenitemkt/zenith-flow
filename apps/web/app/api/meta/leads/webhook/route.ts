import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleLeadgenChange, leadsWebhookVerifyToken } from "@/lib/meta-lead-ads";

export const maxDuration = 60;

/** Handshake da assinatura `page/leadgen` (feita pelo próprio sistema ao ativar a integração). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === leadsWebhookVerifyToken()) {
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function validSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) return new NextResponse("Invalid signature", { status: 403 });
  const payload = JSON.parse(rawBody) as { object?: string; entry?: Array<{ changes?: Array<{ field?: string; value?: Record<string, string> }> }> };
  if (payload.object === "page") {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen" && change.value) await handleLeadgenChange(change.value);
      }
    }
  }
  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
