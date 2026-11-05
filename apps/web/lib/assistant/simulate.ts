import { buildSystemPrompt } from "./prompt";
import { splitBubbles } from "./style";
import { callClaude, loadAssistant, type Block } from "./agent";
import { findFreeSlots, formatSlot } from "./calendar";
import type { AssistantConfig } from "./config";

// Simulador do painel: mesma Milena (prompt, modelo, regras e ferramentas), mas nada sai daqui.
// Não envia WhatsApp, não cria evento, não avisa sócios e não grava conversa no banco.
// A única leitura externa é a agenda (horários livres de verdade).

export interface SimMessage {
  role: "user" | "assistant";
  content: string;
  image?: { mediaType: string; data: string };
}

export interface SimInput {
  messages: SimMessage[];
  profileName?: string;
  leadContext?: string;
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function simulateTool(name: string, input: Record<string, unknown>, config: AssistantConfig, now: Date, actions: string[]): Promise<string> {
  switch (name) {
    case "check_availability": {
      try {
        const slots = await findFreeSlots(config, now);
        if (!slots.length) return "Sem horários livres nos próximos 7 dias. Chame os sócios com request_human.";
        const ordered = config.meeting.preferMorning ? [...slots.filter((s) => s.period === "manha"), ...slots.filter((s) => s.period === "tarde")] : slots;
        actions.push("Consultou a agenda");
        return ordered.slice(0, 8).map((s) => `${s.start.toISOString()} = ${formatSlot(s.start)} (${s.period})`).join("\n");
      } catch {
        actions.push("Agenda indisponível (Google não conectado?)");
        return "Agenda indisponível agora. Diga que vai confirmar os horários com a equipe.";
      }
    }
    case "book_meeting": {
      const start = new Date(String(input.start_iso));
      if (Number.isNaN(start.getTime())) return "Horário inválido.";
      const needsApproval = start.getTime() - now.getTime() < config.meeting.partnerApprovalUnderHours * 3_600_000;
      const extra = [input.email && `e-mail ${input.email}`, input.company && `empresa ${input.company}`].filter(Boolean).join(", ");
      if (needsApproval) {
        actions.push(`Pediria aprovação dos sócios para ${formatSlot(start)} (menos de ${config.meeting.partnerApprovalUnderHours} h)${extra ? ` · ${extra}` : ""}`);
        return "Pedido enviado aos sócios. Avise a pessoa que você confirma a disponibilidade e já retorna.";
      }
      actions.push(`Agendaria reunião em ${formatSlot(start)} com link do Meet${extra ? ` · ${extra}` : ""}. Agende você na agenda.`);
      return `Agendado para ${formatSlot(start)}. Confirme para a pessoa.`;
    }
    case "cancel_meeting":
      actions.push("Desmarcaria a reunião desta pessoa e avisaria os sócios");
      return "Reunião desmarcada.";
    case "classify_lead":
      actions.push(`Triagem: ${String(input.classification).replace("_", " ")} · ${input.reason}`);
      return "Registrado.";
    case "request_human":
      actions.push(`Chamaria um humano e pausaria: ${input.reason}. ${input.summary}`);
      return "Sócios avisados. A assistente fica pausada nesta conversa.";
    case "payment_instructions": {
      const p = config.entryProduct;
      if (input.method === "pix") {
        actions.push(`Pagamento no Pix (${brl(p.pricePix)})${config.payment.pixKey ? "" : ". Chave Pix não configurada"}`);
        if (!config.payment.pixKey) return "Chave Pix ainda não configurada. Diga que a equipe envia os dados de pagamento em instantes.";
        return `Chave Pix: ${config.payment.pixKey}. Valor ${brl(p.pricePix)}. Peça o comprovante. A equipe confirma o recebimento e o prazo de ${p.deliveryBusinessDays} dias úteis começa a partir daí.`;
      }
      actions.push(`Pagamento no cartão (${brl(p.priceCard)} em até ${p.maxInstallments}x). Gere o link`);
      return "Link de cartão ainda é gerado pela equipe. Diga que o link chega em instantes por aqui.";
    }
    default:
      return "Ferramenta desconhecida.";
  }
}

export async function simulateTurn(agencyId: string, input: SimInput): Promise<{ bubbles: string[]; actions: string[] }> {
  const { config } = await loadAssistant(agencyId);
  const now = new Date();

  const messages: { role: string; content: Block[] }[] = [];
  for (const m of input.messages.slice(-40)) {
    const blocks: Block[] = [];
    if (m.image && m.role === "user" && /^image\/(jpeg|png|gif|webp)$/.test(m.image.mediaType)) {
      blocks.push({ type: "image", source: { type: "base64", media_type: m.image.mediaType, data: m.image.data } });
    }
    if (m.content.trim()) blocks.push({ type: "text", text: m.content.trim() });
    if (!blocks.length) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content.push(...blocks);
    else messages.push({ role: m.role, content: blocks });
  }
  if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "(início da conversa)" }] });
  if (messages[messages.length - 1]?.role !== "user") throw new Error("A última mensagem precisa ser do lead.");

  const system = buildSystemPrompt(config, {
    now,
    profileName: input.profileName?.trim() || null,
    leadSummary: input.leadContext?.trim() || null,
    classification: null,
    upcomingBooking: null,
  });

  const actions: string[] = [];
  let reply = "";
  for (let round = 0; round < 6; round++) {
    const response = await callClaude(config, system, messages);
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    reply = response.content.filter((b) => b.type === "text").map((b) => String(b.text)).join("\n").trim();
    if (response.stop_reason !== "tool_use" || !toolUses.length) break;
    messages.push({ role: "assistant", content: response.content });
    const results: Block[] = [];
    for (const use of toolUses) {
      const output = await simulateTool(String(use.name), (use.input ?? {}) as Record<string, unknown>, config, now, actions);
      results.push({ type: "tool_result", tool_use_id: use.id, content: output });
    }
    messages.push({ role: "user", content: results });
  }

  return { bubbles: splitBubbles(reply), actions };
}
