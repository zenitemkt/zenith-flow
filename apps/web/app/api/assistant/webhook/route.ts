import { NextResponse } from "next/server";
import { raiseSystemAlert, resolveSystemAlert } from "@/lib/system-alerts";
import { Prisma, prisma } from "@zenite-mkt/db";
import { loadAssistant } from "@/lib/assistant/agent";
import { assistantAgencyId } from "@/lib/assistant/calendar";
import { notifyPartners } from "@/lib/assistant/notify";
import { handleLeadButton, handlePartnerButton, replyAt } from "@/lib/assistant/process";
import { verifyWhatsappSignature } from "@/lib/assistant/whatsapp";
import { phoneVariants } from "@/lib/assistant/form-outreach";
import { onProspectReply } from "@/lib/prospecting/outreach";

/** Conversa pelo número, aceitando o celular com ou sem o 9 extra (o WhatsApp às vezes usa o formato antigo). */
async function findConversation(agencyId: string, phone: string) {
  const variants = phoneVariants(phone);
  return (
    (await prisma.assistantConversation.findUnique({ where: { agencyId_phone: { agencyId, phone } } })) ??
    (variants.length > 1 ? await prisma.assistantConversation.findFirst({ where: { agencyId, phone: { in: variants } } }) : null)
  );
}

/** Webhook do WhatsApp (Cloud API, coexistência) da assistente virtual. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.ASSISTANT_WA_VERIFY_TOKEN) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

interface WaMessage {
  id: string;
  from: string;
  to?: string;
  type: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string; title: string } };
  button?: { payload?: string; text?: string };
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  audio?: { id: string };
  video?: { id: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string };
}

function describe(m: WaMessage): { content: string; mediaId: string | null; mediaType: string | null } {
  switch (m.type) {
    case "text":
      return { content: m.text?.body ?? "", mediaId: null, mediaType: null };
    case "interactive":
      return { content: m.interactive?.button_reply?.title ?? "[resposta de botão]", mediaId: null, mediaType: null };
    case "button":
      return { content: m.button?.text ?? "[resposta de botão]", mediaId: null, mediaType: null };
    case "audio":
      return { content: "[áudio]", mediaId: m.audio?.id ?? null, mediaType: "audio" };
    case "image":
      return { content: m.image?.caption ? `[imagem] ${m.image.caption}` : "[imagem sem legenda]", mediaId: m.image?.id ?? null, mediaType: "image" };
    case "document":
      return { content: `[documento ${m.document?.filename ?? ""}] ${m.document?.caption ?? ""}`.trim(), mediaId: m.document?.id ?? null, mediaType: "document" };
    case "video":
      return { content: `[vídeo] ${m.video?.caption ?? ""}`.trim(), mediaId: null, mediaType: "video" };
    case "sticker":
      return { content: "[figurinha]", mediaId: null, mediaType: "sticker" };
    case "location":
      return { content: `[localização] ${m.location?.name ?? ""} ${m.location?.latitude},${m.location?.longitude}`, mediaId: null, mediaType: "other" };
    default:
      return { content: `[mensagem do tipo ${m.type}]`, mediaId: null, mediaType: "other" };
  }
}

/** Diagnóstico: registra cada entrega da Meta (aparece no painel da assistente). */
async function logWebhook(raw: string, signatureOk: boolean) {
  const agencyId = assistantAgencyId();
  if (!agencyId) return;
  let summary: Record<string, unknown> = {};
  try {
    const payload = JSON.parse(raw);
    const values = (payload?.entry ?? []).flatMap((e: { changes?: { field?: string; value?: Record<string, unknown> }[] }) => (e.changes ?? []).map((c) => ({ field: c.field, value: c.value ?? {} })));
    summary = {
      fields: values.map((v: { field?: string }) => v.field),
      messages: values.flatMap((v: { value: Record<string, unknown> }) => ((v.value.messages as { from?: string; type?: string }[] | undefined) ?? []).map((m) => `${m.from} (${m.type})`)),
      echoes: values.flatMap((v: { value: Record<string, unknown> }) => ((v.value.message_echoes as { to?: string }[] | undefined) ?? []).map((m) => m.to)),
      statuses: values.reduce((n: number, v: { value: Record<string, unknown> }) => n + (((v.value.statuses as unknown[] | undefined) ?? []).length), 0),
    };
  } catch {
    summary = { parseError: true };
  }
  await prisma.auditLog.create({
    data: { agencyId, actorType: "system", action: "assistant.webhook", resourceType: "whatsapp", resourceId: signatureOk ? "ok" : "bad_signature", metadata: summary as Prisma.InputJsonValue },
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signatureOk = verifyWhatsappSignature(raw, request.headers.get("x-hub-signature-256"));
  await logWebhook(raw, signatureOk).catch(() => null);
  if (!signatureOk) {
    // Chave secreta do app errada: a Meta entrega, mas o sistema recusa. Avisa no sino para não ficar mudo.
    const alertAgency = assistantAgencyId();
    if (alertAgency && request.headers.get("x-hub-signature-256")) {
      await raiseSystemAlert({
        agencyId: alertAgency,
        key: "assistant:webhook-signature",
        category: "AUTOMATION",
        severity: "CRITICAL",
        title: "WhatsApp: mensagens recusadas pela assinatura",
        detail: "A chave secreta do app (ASSISTANT_WA_APP_SECRET) não bate com o app da Meta que envia o webhook.",
        href: "/automacoes/assistente",
      }).catch(() => null);
    }
    return new Response("invalid signature", { status: 401 });
  }
  const agencyId = assistantAgencyId();
  if (!agencyId) return NextResponse.json({ ok: true });
  const { enabled, config } = await loadAssistant(agencyId);
  const partners = new Set(config.notifications.partnerPhones.map((p) => p.replace(/\D/g, "")));
  const payload = JSON.parse(raw);

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const profiles = new Map<string, string>((value.contacts ?? []).map((c: { wa_id: string; profile?: { name?: string } }) => [c.wa_id, c.profile?.name ?? ""]));

      // Coexistência: mensagem enviada pela equipe pelo app do celular. A equipe assumiu, a assistente pausa.
      for (const echo of (value.message_echoes ?? []) as WaMessage[]) {
        if (!echo.to || partners.has(echo.to)) continue;
        const conv = (await findConversation(agencyId, echo.to)) ?? (await prisma.assistantConversation.create({ data: { agencyId, phone: echo.to, mode: "human" } }));
        // Primeira mensagem manual marcada com "Já enviei": conta como fala da própria Milena, que segue dali.
        const handoff = conv.autoTakeoverAt && Date.now() - conv.autoTakeoverAt.getTime() < 7 * 24 * 3600_000;
        const echoContent = describe(echo).content;
        // "Já enviei" clicado antes do eco chegar: o texto preparado já foi registrado sem id da Meta — só completa, não duplica.
        const takeoverAt = conv.autoTakeoverAt?.getTime() ?? 0;
        const placeholder = handoff
          ? await prisma.assistantMessage.findFirst({
              where: { conversationId: conv.id, role: "assistant", waMessageId: null, createdAt: { gte: new Date(takeoverAt - 60_000), lte: new Date(takeoverAt + 60_000) } },
              orderBy: { createdAt: "asc" },
            })
          : null;
        if (placeholder && !(await prisma.assistantMessage.findUnique({ where: { waMessageId: echo.id }, select: { id: true } }))) {
          await prisma.assistantMessage.update({ where: { id: placeholder.id }, data: { waMessageId: echo.id, content: echoContent } });
        } else {
          await prisma.assistantMessage.upsert({ where: { waMessageId: echo.id }, create: { conversationId: conv.id, role: handoff ? "assistant" : "partner", content: echoContent, waMessageId: echo.id }, update: {} });
        }
        if (!handoff) await prisma.assistantConversation.update({ where: { id: conv.id }, data: { mode: "human", replyDueAt: null } });
      }

      for (const message of (value.messages ?? []) as WaMessage[]) {
        const buttonId = message.interactive?.button_reply?.id ?? message.button?.payload ?? null;
        // Sócio: só a resposta aos botões de aprovação é tratada à parte; o resto vira conversa normal (permite testar a Milena).
        if (partners.has(message.from) && buttonId && /^(approve|deny)_/.test(buttonId)) {
          await handlePartnerButton(agencyId, buttonId);
          continue;
        }
        let conv = await findConversation(agencyId, message.from);
        const isNew = !conv;
        if (!conv) conv = await prisma.assistantConversation.create({ data: { agencyId, phone: message.from, profileName: profiles.get(message.from) || null } });
        const { content, mediaId, mediaType } = describe(message);
        const stored = await prisma.assistantMessage.upsert({ where: { waMessageId: message.id }, create: { conversationId: conv.id, role: "user", content, mediaId, mediaType, waMessageId: message.id }, update: {} });
        if (stored.createdAt.getTime() < Date.now() - 60_000) continue; // reenvio da Meta, já tratado

        // Respondeu a prospecção: engajou, vira Lead no Comercial (mesmo com a Milena desligada).
        if (conv.prospectId && !conv.leadId) {
          const leadId = await onProspectReply(agencyId, conv).catch((e) => {
            console.error("prospect_reply_lead_failed", conv!.id, e);
            return null;
          });
          if (leadId) {
            conv = { ...conv, leadId };
            await notifyPartners(config, `${config.name}: ${conv.profileName ?? "empresa da prospecção"} (+${conv.phone}) respondeu a prospecção no WhatsApp e virou lead.`).catch(() => false);
          }
        }

        // Desligada: a conversa aparece na caixa de Conversas, mas a assistente não responde.
        if (!enabled) {
          await prisma.assistantConversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date() } });
          continue;
        }
        if (buttonId && /^(confirm|cancel)_/.test(buttonId)) {
          await handleLeadButton(agencyId, buttonId);
          continue;
        }
        if (isNew && config.notifications.onNewContact && !partners.has(message.from)) {
          const delivered = await notifyPartners(config, `${config.name}: novo contato no WhatsApp, ${profiles.get(message.from) || "sem nome"} (+${message.from}).`).catch(() => false);
          if (delivered) {
            await resolveSystemAlert(agencyId, "assistant:partner-notify");
          } else {
            // Falha silenciosa comum: sócio fora da janela de 24h e sem ASSISTANT_PARTNER_TEMPLATE configurado.
            await raiseSystemAlert({
              agencyId,
              key: "assistant:partner-notify",
              category: "AUTOMATION",
              severity: "WARNING",
              title: "WhatsApp: aviso de novo contato não chegou aos sócios",
              detail: "Confira os números em Configurações da assistente e, se o sócio não conversa com o número da Zenite há mais de 24h, configure um modelo aprovado em ASSISTANT_PARTNER_TEMPLATE.",
              href: "/automacoes/assistente",
            }).catch(() => null);
          }
        }
        if (conv.mode === "bot" && !conv.counterpartBot) {
          await prisma.assistantConversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date(), replyDueAt: replyAt(config.replyDelaySeconds), autoTakeoverAt: null, followUpStage: 0 } });
        } else {
          await prisma.assistantConversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date(), followUpStage: 0 } });
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
