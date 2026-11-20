import { randomBytes } from "node:crypto";
import { prisma } from "@zenite-mkt/db";
import { brtDateString } from "@/lib/assistant/calendar";
import { isMobileBr, phoneVariants } from "@/lib/assistant/form-outreach";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/meta-ads";
import { EMAIL_FOLLOW_UP_DAYS, WHATSAPP_FOLLOW_UP_DAYS, mergeProspectingConfig, type ProspectingConfig } from "./config";
import { emailHook, renderCopy, whatsappHook, type ProspectCopyInput } from "./copy";
import { convertProspectToLead } from "./search";

type Channel = "whatsapp" | "email";

const dayOf = (now: Date) => new Date(`${brtDateString(now)}T00:00:00.000Z`);

/** Reserva um envio no limite do dia; false = limite atingido. Devolve a vaga com `releaseSend` se o envio falhar. */
export async function reserveSend(agencyId: string, channel: Channel, limit: number, now = new Date()): Promise<boolean> {
  const day = dayOf(now);
  await prisma.prospectSendLog.upsert({ where: { agencyId_channel_day: { agencyId, channel, day } }, create: { agencyId, channel, day }, update: {} });
  const result = await prisma.prospectSendLog.updateMany({ where: { agencyId, channel, day, count: { lt: limit } }, data: { count: { increment: 1 } } });
  return result.count === 1;
}

async function releaseSend(agencyId: string, channel: Channel, now = new Date()) {
  await prisma.prospectSendLog.updateMany({ where: { agencyId, channel, day: dayOf(now), count: { gt: 0 } }, data: { count: { decrement: 1 } } });
}

export async function sentToday(agencyId: string, now = new Date()): Promise<Record<Channel, number>> {
  const rows = await prisma.prospectSendLog.findMany({ where: { agencyId, day: dayOf(now) }, select: { channel: true, count: true } });
  return { whatsapp: rows.find((r) => r.channel === "whatsapp")?.count ?? 0, email: rows.find((r) => r.channel === "email")?.count ?? 0 };
}

/** Mensagem pronta do primeiro contato no WhatsApp, já personalizada pra empresa. */
export function whatsappOpenerFor(config: ProspectingConfig, prospect: ProspectCopyInput): string {
  return renderCopy(config.whatsappOpener, prospect, whatsappHook(prospect));
}

export function whatsappFollowUpFor(config: ProspectingConfig, prospect: ProspectCopyInput): string {
  return renderCopy(config.whatsappFollowUp, prospect, whatsappHook(prospect));
}

export const whatsappLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

/**
 * Rotina da manhã: primeiros contatos do dia (maior pontuação, só celular, até o limite diário) e
 * follow-ups vencidos (primeiro contato há 3 dias ou mais, sem resposta). Tudo enviado à mão.
 */
export async function getMorningRoutine(agencyId: string, config: ProspectingConfig, now = new Date()) {
  const today = await sentToday(agencyId, now);
  const remaining = Math.max(0, config.dailyLimits.whatsapp - today.whatsapp);
  const [candidates, followUps] = await Promise.all([
    prisma.prospect.findMany({
      where: { agencyId, status: { in: ["NOVO", "CONTATADO"] }, optOut: false, whatsappSentAt: null, phone: { not: null } },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: 300,
    }),
    prisma.prospect.findMany({
      where: { agencyId, status: "CONTATADO", optOut: false, whatsappFollowUpAt: null, whatsappSentAt: { lte: new Date(now.getTime() - WHATSAPP_FOLLOW_UP_DAYS * 86_400_000) } },
      orderBy: { whatsappSentAt: "asc" },
      take: 100,
    }),
  ]);
  return { firstContacts: candidates.filter((p) => isMobileBr(p.phone)).slice(0, remaining), followUps, remaining, sentToday: today.whatsapp };
}

/** "Já enviei o follow-up" (manual, pelo celular do número da Milena). */
export async function markWhatsappFollowUpSent(agencyId: string, prospectId: string, now = new Date()): Promise<void> {
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, agencyId } });
  if (!prospect) throw new Error("Prospect não encontrado.");
  if (!prospect.whatsappSentAt) throw new Error("Faça o primeiro contato antes do follow-up.");
  if (prospect.whatsappFollowUpAt) return;
  const conv = await prisma.assistantConversation.findFirst({ where: { agencyId, prospectId: prospect.id } });
  if (conv && !conv.leadId) {
    // Renova a janela de "Já enviei": o eco do celular conta como fala da Milena, que segue se a empresa responder.
    await prisma.assistantConversation.update({ where: { id: conv.id }, data: { autoTakeoverAt: now, mode: "bot", replyDueAt: null } });
    await prisma.assistantMessage.updateMany({ where: { conversationId: conv.id, role: "partner" }, data: { role: "assistant" } });
  }
  await prisma.prospect.update({ where: { id: prospect.id }, data: { whatsappFollowUpAt: now, lastContactedAt: now } });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailHtml(body: string, optOutUrl: string): string {
  const paragraphs = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:sans-serif;max-width:560px;color:#101828;font-size:15px;line-height:1.5">${paragraphs}<p style="margin-top:24px;color:#98A2B3;font-size:12px">Não quer mais receber nossos e-mails? <a href="${optOutUrl}" style="color:#98A2B3">Sair da lista</a>.</p></div>`;
}

/**
 * "Enviar e-mails de hoje": primeiro e-mail pra quem ainda não recebeu e o lembrete de 3 dias pra
 * quem não respondeu, até o limite diário. Lembretes têm prioridade; depois, maior pontuação.
 */
export async function sendDueProspectEmails(agencyId: string, now = new Date()): Promise<{ sent: number; failed: number; limitReached: boolean }> {
  const settings = await prisma.prospectingSettings.findUnique({ where: { agencyId } });
  const config = mergeProspectingConfig(settings?.config);
  if (!config.email.enabled) throw new Error("Ative os e-mails automáticos antes de enviar.");
  if (!isEmailConfigured()) throw new Error("O envio de e-mail (Resend) não está configurado no sistema.");

  const due = await prisma.prospect.findMany({
    where: {
      agencyId,
      optOut: false,
      email: { not: null },
      status: { in: ["NOVO", "CONTATADO"] },
      OR: [{ emailStep: 0 }, { emailStep: 1, nextEmailAt: { lte: now } }],
    },
    orderBy: [{ emailStep: "desc" }, { score: "desc" }],
    take: config.dailyLimits.email,
  });

  let sent = 0;
  let failed = 0;
  let limitReached = false;
  for (const prospect of due) {
    if (!(await reserveSend(agencyId, "email", config.dailyLimits.email, now))) {
      limitReached = true;
      break;
    }
    const step = config.email.steps[prospect.emailStep]!;
    const token = prospect.optOutToken ?? randomBytes(18).toString("base64url");
    const optOutUrl = `${getAppBaseUrl()}/api/public/prospect-optout?t=${token}`;
    const body = renderCopy(step.body, prospect, emailHook(prospect));
    try {
      await sendEmail({
        to: prospect.email!,
        subject: renderCopy(step.subject, prospect, emailHook(prospect)),
        html: emailHtml(body, optOutUrl),
        text: `${body}\n\nNão quer mais receber? Sair da lista: ${optOutUrl}`,
        from: config.email.fromEmail || undefined,
        replyTo: config.email.replyTo || undefined,
        headers: { "List-Unsubscribe": `<${optOutUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
    } catch (error) {
      console.error("prospect_email_failed", prospect.id, error);
      await releaseSend(agencyId, "email", now);
      failed++;
      continue;
    }
    const nextStep = prospect.emailStep + 1;
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        emailStep: nextStep,
        nextEmailAt: nextStep < config.email.steps.length ? new Date(now.getTime() + EMAIL_FOLLOW_UP_DAYS * 86_400_000) : null,
        lastContactedAt: now,
        status: "CONTATADO",
        optOutToken: token,
      },
    });
    sent++;
  }
  return { sent, failed, limitReached };
}

/**
 * "Já enviei" o primeiro WhatsApp (mandado à mão pelo celular do número da Milena): abre a conversa
 * em modo Milena, ligada ao prospect. Se a empresa responder, vira Lead e a Milena segue; se não
 * responder, o follow-up (também manual) aparece na rotina da manhã 3 dias depois.
 */
export async function markWhatsappSent(agencyId: string, prospectId: string, now = new Date()): Promise<void> {
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, agencyId } });
  if (!prospect) throw new Error("Prospect não encontrado.");
  if (!isMobileBr(prospect.phone)) throw new Error("Esse telefone não é celular, não dá pra chamar no WhatsApp.");
  if (prospect.whatsappSentAt) return;
  const settings = await prisma.prospectingSettings.findUnique({ where: { agencyId } });
  const config = mergeProspectingConfig(settings?.config);
  if (!(await reserveSend(agencyId, "whatsapp", config.dailyLimits.whatsapp, now))) {
    throw new Error(`Limite de ${config.dailyLimits.whatsapp} primeiros contatos por dia no WhatsApp atingido. Continue amanhã pra proteger o número.`);
  }

  const phone = prospect.phone!;
  const existing = await prisma.assistantConversation.findFirst({ where: { agencyId, phone: { in: phoneVariants(phone) } } });
  const linking = { prospectId: prospect.id, profileName: prospect.name, mode: "bot", autoTakeoverAt: now, replyDueAt: null, failures: 0, followUpStage: 0, followUpOptOut: false };
  const conv = existing
    ? await prisma.assistantConversation.update({ where: { id: existing.id }, data: linking })
    : await prisma.assistantConversation.create({ data: { agencyId, phone, ...linking } });

  // Se a mensagem já saiu do celular antes do clique, ela chegou como "equipe": passa a contar como da Milena.
  await prisma.assistantMessage.updateMany({ where: { conversationId: conv.id, role: "partner" }, data: { role: "assistant" } });
  const outbound = await prisma.assistantMessage.count({ where: { conversationId: conv.id, role: "assistant" } });
  await prisma.assistantMessage.create({
    data: {
      conversationId: conv.id,
      role: "user",
      createdAt: new Date(now.getTime() - 1),
      content: `[sistema] Conversa de prospecção ativa: a ${prospect.name} (${prospect.segment} em ${prospect.city}) foi encontrada no Google Maps e recebeu a primeira mensagem desta conversa, enviada por você. Ela não pediu contato. Se responder, qualifique com calma, sem empurrar reunião logo de cara.`,
    },
  });
  // Ainda não chegou o eco do celular: registra o texto preparado (o eco depois só ganha o id da Meta).
  if (outbound === 0) {
    await prisma.assistantMessage.create({ data: { conversationId: conv.id, role: "assistant", createdAt: now, content: whatsappOpenerFor(config, prospect) } });
  }
  await prisma.prospect.update({ where: { id: prospect.id }, data: { whatsappSentAt: now, lastContactedAt: now, status: "CONTATADO" } });
}

/** Opt-out pelo link do e-mail ou quando a pessoa pede pra parar no WhatsApp. */
export async function optOutProspect(where: { optOutToken: string } | { id: string }): Promise<boolean> {
  const result = await prisma.prospect.updateMany({ where, data: { optOut: true, nextEmailAt: null } });
  return result.count > 0;
}

/** A empresa respondeu o WhatsApp da prospecção: engajou, entra no Comercial como Lead. Devolve o lead (ou null se já era). */
export async function onProspectReply(agencyId: string, conv: { id: string; prospectId: string | null; leadId: string | null }): Promise<string | null> {
  if (!conv.prospectId || conv.leadId) return null;
  const leadId = await convertProspectToLead(agencyId, conv.prospectId, null);
  await prisma.assistantConversation.update({ where: { id: conv.id }, data: { leadId } });
  return leadId;
}

/**
 * Pediu pra parar (stop_follow_up da Milena) numa conversa de prospecção: sai da lista de vez e, se a
 * resposta já tinha virado lead, o lead é desqualificado — pedir pra parar não é engajamento.
 */
export async function onProspectStop(agencyId: string, conv: { prospectId: string | null; leadId: string | null }): Promise<void> {
  if (!conv.prospectId) return;
  await prisma.prospect.updateMany({ where: { id: conv.prospectId, agencyId }, data: { optOut: true, nextEmailAt: null, status: "DESQUALIFICADO" } });
  if (!conv.leadId) return;
  const lead = await prisma.lead.findFirst({ where: { id: conv.leadId, agencyId }, select: { status: true } });
  if (!lead || lead.status === "DESQUALIFICADO" || lead.status === "CONVERTIDO") return;
  await prisma.$transaction([
    prisma.lead.update({ where: { id: conv.leadId }, data: { status: "DESQUALIFICADO" } }),
    prisma.leadStatusHistory.create({ data: { leadId: conv.leadId, fromStatus: lead.status, toStatus: "DESQUALIFICADO", reason: "Prospecção: pediu pra não receber mais mensagens." } }),
  ]);
}
