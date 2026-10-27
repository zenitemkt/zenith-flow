import { prisma } from "@zenite-mkt/db";
import { upsertLeadSubmission } from "@/lib/lead-contact";
import { mergeAssistantConfig, type AssistantConfig } from "./config";
import { buildSystemPrompt } from "./prompt";
import { splitBubbles } from "./style";
import { downloadMedia, sendText, transcribeAudio } from "./whatsapp";
import { askPartnersApproval, notifyPartners } from "./notify";
import { cancelMeeting, createMeeting, findFreeSlots, formatSlot } from "./calendar";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export async function loadAssistant(agencyId: string): Promise<{ enabled: boolean; config: AssistantConfig }> {
  const settings = await prisma.assistantSettings.findUnique({ where: { agencyId } });
  return { enabled: settings?.enabled ?? false, config: mergeAssistantConfig(settings?.config) };
}

type Conversation = NonNullable<Awaited<ReturnType<typeof prisma.assistantConversation.findUnique>>>;

/** Garante um lead/card no Zenite Flow para o telefone da conversa. */
export async function ensureLead(conversation: Conversation): Promise<string | null> {
  if (conversation.leadId) return conversation.leadId;
  const result = await prisma.$transaction((tx) =>
    upsertLeadSubmission(tx, {
      agencyId: conversation.agencyId,
      name: conversation.profileName?.trim() || "Contato do WhatsApp",
      phone: `+${conversation.phone}`,
      source: "WhatsApp (Milena)",
      summary: "Primeiro contato pelo WhatsApp.",
      createOpportunity: "new-only",
    }),
  );
  await prisma.assistantConversation.update({ where: { id: conversation.id }, data: { leadId: result.lead.id } });
  return result.lead.id;
}

async function leadSummary(leadId: string | null): Promise<string | null> {
  if (!leadId) return null;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, company: true, email: true, submissions: { orderBy: { createdAt: "desc" }, take: 2, select: { source: true, service: true, investment: true, summary: true, createdAt: true } } },
  });
  if (!lead) return null;
  const lines = [`Nome: ${lead.name}`, lead.company && `Empresa: ${lead.company}`, lead.email && `E-mail: ${lead.email}`];
  for (const s of lead.submissions) {
    if (s.source === "WhatsApp (Milena)") continue;
    lines.push(`Envio de ${s.source ?? "origem desconhecida"} em ${s.createdAt.toLocaleDateString("pt-BR")}:`, s.service && `Segmento: ${s.service}`, s.investment && `Verba informada: ${s.investment}`, s.summary);
  }
  return lines.filter(Boolean).join("\n");
}

const TOOLS = [
  { name: "check_availability", description: "Lista horários livres nas agendas dos dois sócios para a reunião rápida.", input_schema: { type: "object", properties: {}, required: [] } },
  {
    name: "book_meeting",
    description: "Agenda a reunião num horário devolvido por check_availability.",
    input_schema: { type: "object", properties: { start_iso: { type: "string" }, email: { type: "string" }, company: { type: "string" } }, required: ["start_iso"] },
  },
  { name: "cancel_meeting", description: "Desmarca a reunião futura desta pessoa (use antes de reagendar).", input_schema: { type: "object", properties: {}, required: [] } },
  {
    name: "classify_lead",
    description: "Registra a triagem.",
    input_schema: { type: "object", properties: { classification: { type: "string", enum: ["icp", "fora_icp", "vendedor", "indefinido"] }, reason: { type: "string" } }, required: ["classification", "reason"] },
  },
  {
    name: "request_human",
    description: "Chama os sócios e pausa a assistente nesta conversa.",
    input_schema: { type: "object", properties: { reason: { type: "string" }, summary: { type: "string" } }, required: ["reason", "summary"] },
  },
  {
    name: "payment_instructions",
    description: "Dados de pagamento do produto de entrada.",
    input_schema: { type: "object", properties: { method: { type: "string", enum: ["cartao", "pix"] } }, required: ["method"] },
  },
];

async function runTool(name: string, input: Record<string, unknown>, conv: Conversation, config: AssistantConfig, now: Date): Promise<string> {
  const who = `${conv.profileName ?? "Contato"} (+${conv.phone})`;
  switch (name) {
    case "check_availability": {
      const slots = await findFreeSlots(config, now);
      if (!slots.length) return "Sem horários livres nos próximos 7 dias. Chame os sócios com request_human.";
      const ordered = config.meeting.preferMorning ? [...slots.filter((s) => s.period === "manha"), ...slots.filter((s) => s.period === "tarde")] : slots;
      return ordered.slice(0, 8).map((s) => `${s.start.toISOString()} = ${formatSlot(s.start)} (${s.period})`).join("\n");
    }
    case "book_meeting": {
      const start = new Date(String(input.start_iso));
      if (Number.isNaN(start.getTime())) return "Horário inválido.";
      const free = await findFreeSlots(config, now);
      if (!free.some((s) => s.start.getTime() === start.getTime())) return "Esse horário não está mais livre. Rode check_availability de novo.";
      const email = typeof input.email === "string" && input.email.includes("@") ? input.email.trim() : null;
      const endsAt = new Date(start.getTime() + config.meeting.durationMinutes * 60_000);
      const needsApproval = start.getTime() - now.getTime() < config.meeting.partnerApprovalUnderHours * 3_600_000;
      const booking = await prisma.assistantBooking.create({
        data: { agencyId: conv.agencyId, conversationId: conv.id, startsAt: start, endsAt, status: needsApproval ? "pending_partner" : "scheduled", calendarEventIds: email ? { leadEmail: email } : undefined },
      });
      if (needsApproval) {
        const asked = await askPartnersApproval(config, booking.id, `${config.name}: ${who} quer reunião ${formatSlot(start)} (menos de ${config.meeting.partnerApprovalUnderHours} h). Podem?`);
        if (!asked) return "Não consegui falar com os sócios. Ofereça horários com mais antecedência.";
        return "Pedido enviado aos sócios. Avise a pessoa que você confirma a disponibilidade e já retorna.";
      }
      await confirmBookingEvent(booking.id, config);
      return `Agendado para ${formatSlot(start)}. Confirme para a pessoa.`;
    }
    case "cancel_meeting": {
      const booking = await prisma.assistantBooking.findFirst({ where: { conversationId: conv.id, status: { in: ["scheduled", "confirmed", "pending_partner"] }, startsAt: { gt: now } }, orderBy: { startsAt: "asc" } });
      if (!booking) return "Nenhuma reunião futura encontrada.";
      await cancelBooking(booking.id, config, "pela conversa");
      return `Reunião de ${formatSlot(booking.startsAt)} desmarcada.`;
    }
    case "classify_lead": {
      await prisma.assistantConversation.update({ where: { id: conv.id }, data: { classification: String(input.classification) } });
      return "Registrado.";
    }
    case "request_human": {
      const ok = config.notifications.onHumanRequest ? await notifyPartners(config, `${config.name}: ${who} precisa de atendimento humano.\nMotivo: ${input.reason}\n${input.summary}`) : true;
      if (!ok) return "Falha ao avisar os sócios. Diga que teve um problema e peça para a pessoa tentar de novo em instantes.";
      await prisma.assistantConversation.update({ where: { id: conv.id }, data: { mode: "human" } });
      return "Sócios avisados. A assistente fica pausada nesta conversa.";
    }
    case "payment_instructions": {
      const p = config.entryProduct;
      if (input.method === "pix") {
        if (!config.payment.pixKey) {
          await notifyPartners(config, `${config.name}: ${who} quer pagar o ${p.name} no Pix (${brl(p.pricePix)}). Chave Pix ainda não configurada no painel.`);
          return "Chave Pix ainda não configurada. Diga que a equipe envia os dados de pagamento em instantes.";
        }
        await notifyPartners(config, `${config.name}: ${who} vai pagar o ${p.name} no Pix (${brl(p.pricePix)}). Confiram o recebimento.`);
        return `Chave Pix: ${config.payment.pixKey}. Valor ${brl(p.pricePix)}. Peça o comprovante. A equipe confirma o recebimento e o prazo de ${p.deliveryBusinessDays} dias úteis começa a partir daí.`;
      }
      await notifyPartners(config, `${config.name}: ${who} quer pagar o ${p.name} no cartão (${brl(p.priceCard)} em até ${p.maxInstallments}x). Gerem o link de pagamento.`);
      return "Link de cartão ainda é gerado pela equipe. Diga que o link chega em instantes por aqui.";
    }
    default:
      return "Ferramenta desconhecida.";
  }
}

/** Cria o evento (com Meet) de uma reserva e avisa os sócios. */
export async function confirmBookingEvent(bookingId: string, config: AssistantConfig) {
  const booking = await prisma.assistantBooking.findUniqueOrThrow({ where: { id: bookingId }, include: { conversation: true } });
  const conv = booking.conversation;
  const leadEmail = (booking.calendarEventIds as { leadEmail?: string } | null)?.leadEmail ?? null;
  const event = await createMeeting(config, {
    start: booking.startsAt,
    title: `Zenite x ${conv.profileName ?? conv.phone}`,
    description: `Reunião rápida agendada pela ${config.name} no WhatsApp (+${conv.phone}).`,
    leadEmail,
  });
  await prisma.assistantBooking.update({
    where: { id: bookingId },
    data: { status: "scheduled", meetUrl: event.meetUrl, calendarEventIds: { leadEmail, calendarId: event.calendarId, eventId: event.eventId } },
  });
  if (config.notifications.onBooking) await notifyPartners(config, `${config.name}: reunião agendada com ${conv.profileName ?? "contato"} (+${conv.phone}) em ${formatSlot(booking.startsAt)}.`);
}

export async function cancelBooking(bookingId: string, config: AssistantConfig, origin: string) {
  const booking = await prisma.assistantBooking.update({ where: { id: bookingId }, data: { status: "cancelled" }, include: { conversation: true } });
  const ids = booking.calendarEventIds as { calendarId?: string; eventId?: string } | null;
  if (ids?.calendarId && ids.eventId) await cancelMeeting(ids.calendarId, ids.eventId).catch((e) => console.error("assistant_cancel_event_failed", e));
  if (config.notifications.onCancellation) await notifyPartners(config, `${config.name}: ${booking.conversation.profileName ?? "contato"} (+${booking.conversation.phone}) desmarcou a reunião de ${formatSlot(booking.startsAt)} (${origin}).`);
}

type Block = Record<string, unknown>;

async function callClaude(config: AssistantConfig, system: string, messages: { role: string; content: Block[] }[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ausente.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: config.model, max_tokens: 1024, system, messages, tools: TOOLS }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Claude ${response.status}: ${JSON.stringify(data?.error ?? data).slice(0, 300)}`);
  return data as { content: Block[]; stop_reason: string };
}

/** Prepara a mídia ainda não lida (transcreve áudio, baixa imagem/PDF) das mensagens novas da pessoa. */
async function mediaBlocks(messages: { id: string; content: string; mediaId: string | null; mediaType: string | null }[]): Promise<Map<string, Block[]>> {
  const extra = new Map<string, Block[]>();
  for (const m of messages) {
    if (!m.mediaId) continue;
    try {
      if (m.mediaType === "audio" && m.content.startsWith("[áudio]")) {
        const { data, mimeType } = await downloadMedia(m.mediaId);
        const text = await transcribeAudio(data, mimeType);
        m.content = text ? `[áudio transcrito] ${text}` : "[áudio vazio ou inaudível]";
        await prisma.assistantMessage.update({ where: { id: m.id }, data: { content: m.content } });
      } else if (m.mediaType === "image" || m.mediaType === "document") {
        const { data, mimeType } = await downloadMedia(m.mediaId);
        const base64 = data.toString("base64");
        if (m.mediaType === "image" && /^image\/(jpeg|png|gif|webp)$/.test(mimeType)) extra.set(m.id, [{ type: "image", source: { type: "base64", media_type: mimeType, data: base64 } }]);
        if (m.mediaType === "document" && mimeType === "application/pdf") extra.set(m.id, [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }]);
      }
    } catch (error) {
      console.error("assistant_media_failed", m.id, error);
      m.content = `${m.content} [não foi possível abrir este arquivo: peça para a pessoa mandar por escrito]`;
    }
  }
  return extra;
}

/** Uma rodada de resposta: lê o histórico, conversa com o Claude (com ferramentas) e envia as bolhas. */
export async function runConversationTurn(conversationId: string): Promise<void> {
  const conv = await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conversationId } });
  const { enabled, config } = await loadAssistant(conv.agencyId);
  if (!enabled || conv.mode !== "bot") return;
  const now = new Date();

  try {
    const leadId = await ensureLead(conv);
    const history = await prisma.assistantMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 40 });
    history.reverse();
    const lastAssistant = history.map((m) => m.role).lastIndexOf("assistant");
    const fresh = history.slice(lastAssistant + 1).filter((m) => m.role === "user");
    const media = await mediaBlocks(fresh);

    const messages: { role: string; content: Block[] }[] = [];
    for (const m of history) {
      const role = m.role === "user" ? "user" : "assistant";
      const text = m.role === "partner" ? `(mensagem enviada pela equipe Zenite) ${m.content}` : m.content;
      const blocks: Block[] = [...(media.get(m.id) ?? []), { type: "text", text }];
      const last = messages[messages.length - 1];
      if (last && last.role === role) last.content.push(...blocks);
      else messages.push({ role, content: blocks });
    }
    if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "(início da conversa)" }] });

    const upcoming = await prisma.assistantBooking.findFirst({ where: { conversationId, status: { in: ["scheduled", "confirmed", "pending_partner"] }, startsAt: { gt: now } }, orderBy: { startsAt: "asc" } });
    const system = buildSystemPrompt(config, {
      now,
      profileName: conv.profileName,
      leadSummary: await leadSummary(leadId),
      classification: conv.classification,
      upcomingBooking: upcoming ? `${formatSlot(upcoming.startsAt)} (${upcoming.status})` : null,
    });

    let reply = "";
    for (let round = 0; round < 6; round++) {
      const response = await callClaude(config, system, messages);
      const toolUses = response.content.filter((b) => b.type === "tool_use");
      reply = response.content.filter((b) => b.type === "text").map((b) => String(b.text)).join("\n").trim();
      if (response.stop_reason !== "tool_use" || !toolUses.length) break;
      messages.push({ role: "assistant", content: response.content });
      const fresher = await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conversationId } });
      const results: Block[] = [];
      for (const use of toolUses) {
        let output: string;
        try {
          output = await runTool(String(use.name), (use.input ?? {}) as Record<string, unknown>, fresher, config, now);
        } catch (error) {
          console.error("assistant_tool_failed", use.name, error);
          output = "A ferramenta falhou. Não invente o resultado: diga que vai verificar com a equipe e use request_human.";
        }
        results.push({ type: "tool_result", tool_use_id: use.id, content: output });
      }
      messages.push({ role: "user", content: results });
    }

    const bubbles = splitBubbles(reply);
    if (!bubbles.length) throw new Error("Resposta vazia do modelo.");
    for (const bubble of bubbles) {
      const waMessageId = await sendText(conv.phone, bubble);
      await prisma.assistantMessage.create({ data: { conversationId, role: "assistant", content: bubble, waMessageId } });
    }
    await prisma.assistantConversation.update({ where: { id: conversationId }, data: { failures: 0 } });
  } catch (error) {
    console.error("assistant_turn_failed", conversationId, error);
    const failures = conv.failures + 1;
    // Nunca deixar a pessoa sem resposta: mensagem de segurança e, na segunda falha seguida, chama os sócios.
    await sendText(conv.phone, "Desculpa, tive um problema aqui para ler sua mensagem. Pode me mandar de novo, por escrito?").catch(() => null);
    if (failures >= 2) {
      await notifyPartners(config, `${config.name}: falhei duas vezes seguidas com ${conv.profileName ?? "contato"} (+${conv.phone}). Assumam a conversa, por favor.`).catch(() => null);
      await prisma.assistantConversation.update({ where: { id: conversationId }, data: { failures: 0, mode: "human" } });
    } else {
      await prisma.assistantConversation.update({ where: { id: conversationId }, data: { failures } });
    }
  }
}
