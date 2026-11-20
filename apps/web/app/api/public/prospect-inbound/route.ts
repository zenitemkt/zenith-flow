import { NextResponse } from "next/server";
import { handleProspectEmailReply, verifyResendWebhook } from "@/lib/prospecting/inbound";

export const maxDuration = 30;

/** Webhook do Resend (email.received): respostas aos e-mails de prospecção. Protegido pela assinatura Svix. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyResendWebhook(raw, request.headers, process.env.RESEND_INBOUND_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }
  const event = JSON.parse(raw) as { type?: string; data?: { email_id?: string; from?: string; to?: string[]; received_for?: string[]; subject?: string } };
  if (event.type !== "email.received" || !event.data?.email_id || !event.data.from) return NextResponse.json({ ok: true, ignored: true });
  const result = await handleProspectEmailReply({
    emailId: event.data.email_id,
    from: event.data.from,
    to: [...(event.data.to ?? []), ...(event.data.received_for ?? [])],
    subject: event.data.subject ?? "",
  });
  return NextResponse.json({ ok: true, ...result });
}
