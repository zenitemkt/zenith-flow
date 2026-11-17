/**
 * Retomada manual de conversa no WhatsApp: a Milena (ou a equipe) falou por último e o lead
 * sumiu. A lista de Leads sinaliza com "!" vermelho depois de `FOLLOW_UP_AFTER_HOURS`, e o
 * lead tem um botão que abre o wa.me com uma mensagem pronta (o admin só aperta Enter).
 * Pelo app do celular não há janela de 24 h nem modelo aprovado da Meta.
 */
import { firstName } from "./form-outreach";

export const FOLLOW_UP_AFTER_HOURS = 48;

/** Status em que não faz sentido cobrar resposta. */
const CLOSED_LEAD_STATUSES = new Set(["DESQUALIFICADO", "CONVERTIDO"]);

export interface WhatsappActivity {
  conversationId: string;
  lastMessageAt: Date;
  /** user = o lead; assistant = Milena; partner = equipe pelo celular. */
  lastMessageRole: string;
}

export interface FollowUpState {
  /** A última fala foi nossa e o lead não respondeu. */
  awaitingReply: boolean;
  /** Horas desde a última fala nossa sem resposta (0 quando não está aguardando). */
  silentHours: number;
  /** Aguardando há `FOLLOW_UP_AFTER_HOURS` ou mais: hora de retomar. */
  needsFollowUp: boolean;
}

export function followUpState(activity: WhatsappActivity | null | undefined, leadStatus: string, now = new Date()): FollowUpState {
  if (!activity || activity.lastMessageRole === "user" || CLOSED_LEAD_STATUSES.has(leadStatus)) {
    return { awaitingReply: false, silentHours: 0, needsFollowUp: false };
  }
  const silentHours = Math.max(0, (now.getTime() - activity.lastMessageAt.getTime()) / 3_600_000);
  return { awaitingReply: true, silentHours, needsFollowUp: silentHours >= FOLLOW_UP_AFTER_HOURS };
}

/** "agora", "há 15 min", "há 5 h", "há 1 dia", "há 3 dias". */
export function timeAgo(date: Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

/** Mensagem amigável de retomada, na voz da Milena. A segunda tentativa muda o texto para não repetir. */
export function suggestFollowUp(leadName: string | null | undefined, previousFollowUps = 0) {
  const name = firstName(leadName);
  const hi = `Oi${name ? `, ${name}` : ""}!`;
  if (previousFollowUps === 0) {
    return `${hi} Vi que ainda não conseguiu ver minha mensagem 😊 Ficou alguma dúvida? Se quiser, te explico rapidinho por aqui.`;
  }
  return `${hi} Passando só pra saber se ainda faz sentido a gente conversar. Se agora não for um bom momento, sem problema, é só me avisar que eu te chamo mais pra frente 😉`;
}
