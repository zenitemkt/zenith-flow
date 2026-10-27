import { prisma } from "@zenite-mkt/db";
import { cancelBooking, confirmBookingEvent, loadAssistant, runConversationTurn } from "./agent";
import { formatSlot } from "./calendar";
import { notifyPartners } from "./notify";
import { sendButtons, sendText } from "./whatsapp";

/** Agenda a resposta da assistente para daqui a `seconds` (cada mensagem nova empurra o prazo). */
export function replyAt(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

/** Lead apertou Confirmar/Desmarcar no lembrete. */
export async function handleLeadButton(agencyId: string, buttonId: string) {
  const { config } = await loadAssistant(agencyId);
  const [action, bookingId] = buttonId.split("_");
  const booking = await prisma.assistantBooking.findFirst({ where: { id: bookingId, agencyId }, include: { conversation: true } });
  if (!booking || booking.status === "cancelled") return;
  const conv = booking.conversation;
  if (action === "confirm") {
    await prisma.assistantBooking.update({ where: { id: booking.id }, data: { status: "confirmed" } });
    await sendText(conv.phone, `Combinado! Aqui está o link da reunião de ${formatSlot(booking.startsAt)}:\n${booking.meetUrl ?? "(o link chega em instantes)"}`);
    await notifyPartners(config, `${config.name}: ${conv.profileName ?? "contato"} (+${conv.phone}) confirmou a reunião de ${formatSlot(booking.startsAt)}.\n${booking.meetUrl ?? ""}`);
  } else if (action === "cancel") {
    await cancelBooking(booking.id, config, "pelo lembrete");
    await prisma.assistantMessage.create({ data: { conversationId: conv.id, role: "user", content: "[sistema] A pessoa desmarcou a reunião pelo lembrete. Pergunte se ela quer reagendar para outro dia e conduza o reagendamento." } });
    await prisma.assistantConversation.update({ where: { id: conv.id }, data: { replyDueAt: replyAt(5), mode: "bot" } });
  }
}

/** Sócio apertou Confirmar/Não posso no pedido de horário com pouca antecedência. */
export async function handlePartnerButton(agencyId: string, buttonId: string) {
  const { config } = await loadAssistant(agencyId);
  const [action, bookingId] = buttonId.split("_");
  const booking = await prisma.assistantBooking.findFirst({ where: { id: bookingId, agencyId, status: "pending_partner" } });
  if (!booking) return; // outro sócio já decidiu
  if (action === "approve") {
    await confirmBookingEvent(booking.id, config);
    await prisma.assistantMessage.create({ data: { conversationId: booking.conversationId, role: "user", content: `[sistema] Os sócios confirmaram o horário ${formatSlot(booking.startsAt)}. Avise a pessoa que está agendado.` } });
  } else {
    await prisma.assistantBooking.update({ where: { id: booking.id }, data: { status: "cancelled" } });
    await prisma.assistantMessage.create({ data: { conversationId: booking.conversationId, role: "user", content: `[sistema] Os sócios não podem em ${formatSlot(booking.startsAt)}. Peça desculpas e ofereça horários com mais antecedência.` } });
  }
  await prisma.assistantConversation.update({ where: { id: booking.conversationId }, data: { replyDueAt: replyAt(5) } });
}

/** Rodada do agendador (chamada a cada minuto): respostas vencidas, aprovações expiradas, lembretes e aviso de início. */
export async function processAssistantQueue(): Promise<Record<string, number>> {
  const now = new Date();
  const stats = { replies: 0, expired: 0, reminders: 0, startNotices: 0 };

  const due = await prisma.assistantConversation.findMany({ where: { replyDueAt: { lte: now }, mode: "bot" }, select: { id: true, replyDueAt: true }, take: 20 });
  for (const conv of due) {
    // Trava otimista: só quem conseguir limpar o prazo responde (evita resposta dobrada se duas rodadas se cruzarem).
    const claimed = await prisma.assistantConversation.updateMany({ where: { id: conv.id, replyDueAt: conv.replyDueAt }, data: { replyDueAt: null } });
    if (claimed.count === 0) continue;
    await runConversationTurn(conv.id);
    stats.replies++;
  }

  const pending = await prisma.assistantBooking.findMany({ where: { status: "pending_partner" }, select: { id: true, agencyId: true, createdAt: true } });
  for (const booking of pending) {
    const { config } = await loadAssistant(booking.agencyId);
    if (now.getTime() - booking.createdAt.getTime() < config.meeting.partnerApprovalTimeoutMinutes * 60_000) continue;
    await handlePartnerButton(booking.agencyId, `deny_${booking.id}`);
    stats.expired++;
  }

  const upcoming = await prisma.assistantBooking.findMany({ where: { status: { in: ["scheduled", "confirmed"] }, startsAt: { gt: new Date(now.getTime() - 15 * 60_000), lt: new Date(now.getTime() + 24 * 3_600_000) } }, include: { conversation: true } });
  for (const booking of upcoming) {
    const { enabled, config } = await loadAssistant(booking.agencyId);
    if (!enabled) continue;
    const phone = booking.conversation.phone;
    if (booking.status === "scheduled" && !booking.reminderSentAt && booking.startsAt.getTime() - now.getTime() <= config.reminders.confirmHoursBefore * 3_600_000 && booking.startsAt > now) {
      await sendButtons(phone, `Oi! Lembrando da nossa reunião hoje, ${formatSlot(booking.startsAt)}, pelo Google Meet. Posso confirmar?`, [
        { id: `confirm_${booking.id}`, title: "Confirmar" },
        { id: `cancel_${booking.id}`, title: "Desmarcar" },
      ]).catch((e) => console.error("assistant_reminder_failed", booking.id, e));
      await prisma.assistantBooking.update({ where: { id: booking.id }, data: { reminderSentAt: now } });
      stats.reminders++;
    }
    if (booking.status === "confirmed" && config.reminders.sendStartNotice && !booking.startNoticeSentAt && booking.startsAt <= now) {
      await sendText(phone, `Estamos te aguardando, a reunião começa agora:\n${booking.meetUrl ?? ""}`.trim()).catch((e) => console.error("assistant_start_notice_failed", booking.id, e));
      await prisma.assistantBooking.update({ where: { id: booking.id }, data: { startNoticeSentAt: now } });
      stats.startNotices++;
    }
  }
  return stats;
}
