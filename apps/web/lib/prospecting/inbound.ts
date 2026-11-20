import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { loadAssistant } from "@/lib/assistant/agent";
import { notifyPartners } from "@/lib/assistant/notify";
import { sendEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/meta-ads";
import { mergeProspectingConfig } from "./config";
import { convertProspectToLead } from "./search";

/**
 * Respostas aos e-mails de prospecção, recebidas pelo Resend (webhook `email.received`). O e-mail
 * de resposta é o "Respostas vão para" da configuração; aqui o sistema descobre de qual empresa veio,
 * para o lembrete, vira Lead (ou sai da lista, se pediu pra sair) e encaminha pra caixa da equipe.
 */

/** Assinatura Svix do webhook do Resend (headers svix-id, svix-timestamp, svix-signature). */
export function verifyResendWebhook(rawBody: string, headers: Headers, secret: string, nowMs = Date.now()): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !secret) return false;
  if (!/^\d+$/.test(timestamp) || Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatures.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Pediu pra sair em vez de engajar. */
export const OPT_OUT_REPLY = /(remov|descadastr|sair da (sua )?lista|n[ãa]o (tenho|temos) interesse|pare de|parem de|n[ãa]o (me )?(envie|mande|mandem))/i;

const stripHtml = (html: string) => html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const address = (raw: string) => (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();

async function receivedEmailText(emailId: string): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "";
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) return "";
  const data = (await response.json().catch(() => null)) as { text?: string | null; html?: string | null } | null;
  return (data?.text?.trim() || (data?.html ? stripHtml(data.html) : "")).slice(0, 20_000);
}

export async function handleProspectEmailReply(event: { emailId: string; from: string; to: string[]; subject: string }): Promise<{ matched: boolean }> {
  const recipients = event.to.map(address);
  const owners = await prisma.prospectingSettings.findMany({ select: { agencyId: true, config: true } });
  const owner = owners.map((o) => ({ agencyId: o.agencyId, config: mergeProspectingConfig(o.config) })).find((o) => o.config.email.replyTo && recipients.includes(o.config.email.replyTo.toLowerCase()));
  if (!owner) return { matched: false };

  const from = address(event.from);
  const body = await receivedEmailText(event.emailId);
  const contact = await prisma.prospectContact.findUnique({ where: { agencyId_normalizedValue: { agencyId: owner.agencyId, normalizedValue: from } }, include: { prospect: true } });
  const prospect = contact?.prospect ?? null;

  let outcome = "Remetente não está na lista de prospecção.";
  let leadId: string | null = null;
  if (prospect && prospect.status !== "VIROU_LEAD" && prospect.status !== "DESQUALIFICADO") {
    if (OPT_OUT_REPLY.test(body)) {
      await prisma.prospect.update({ where: { id: prospect.id }, data: { optOut: true, nextEmailAt: null, status: "DESQUALIFICADO" } });
      outcome = "Pediu pra sair: saiu da lista.";
    } else {
      leadId = await convertProspectToLead(owner.agencyId, prospect.id, null);
      await prisma.prospect.update({ where: { id: prospect.id }, data: { nextEmailAt: null } });
      outcome = "Virou lead no Comercial.";
    }
  } else if (prospect) {
    leadId = prospect.leadId;
    outcome = prospect.status === "VIROU_LEAD" ? "Já era lead." : "Já estava fora da lista.";
  }

  const name = prospect?.name ?? from;
  if (owner.config.email.forwardTo) {
    const leadLink = leadId ? `<p><a href="${getAppBaseUrl()}/comercial/leads/${leadId}">Abrir o lead no Zenite Flow</a></p>` : "";
    await sendEmail({
      to: owner.config.email.forwardTo,
      subject: `Resposta da prospecção: ${name}${event.subject ? ` (${event.subject})` : ""}`.slice(0, 200),
      html: `<div style="font-family:sans-serif;color:#101828"><p><strong>${escapeHtml(name)}</strong> (${escapeHtml(from)}) respondeu. ${escapeHtml(outcome)}</p>${leadLink}<hr><p style="white-space:pre-wrap">${escapeHtml(body || "(sem texto)")}</p></div>`,
      replyTo: from,
    }).catch((e) => console.error("prospect_reply_forward_failed", e));
  }
  if (prospect && leadId && outcome === "Virou lead no Comercial.") {
    const { config } = await loadAssistant(owner.agencyId);
    await notifyPartners(config, `Prospecção: ${name} respondeu o e-mail e virou lead.`).catch(() => false);
  }
  return { matched: Boolean(prospect) };
}
