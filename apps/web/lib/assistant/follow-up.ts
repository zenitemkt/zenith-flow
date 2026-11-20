/**
 * Retomada manual de conversa no WhatsApp: a Milena (ou a equipe) falou por último e o lead
 * sumiu. A lista de Leads sinaliza com "!" vermelho depois de `FOLLOW_UP_AFTER_HOURS`, e o
 * lead tem um botão que abre o wa.me com uma mensagem pronta (o admin só aperta Enter).
 * Pelo app do celular não há janela de 24 h nem modelo aprovado da Meta.
 */
import { firstName } from "./form-outreach";

export const FOLLOW_UP_AFTER_HOURS = 48;

/** Status em que não faz sentido cobrar resposta. */
export const CLOSED_LEAD_STATUSES = new Set(["DESQUALIFICADO", "CONVERTIDO"]);

/**
 * Retomada automática (seção combinada com o Gabriel em 2026-11-20): 23h ainda está dentro da
 * janela de 24h da Meta (mensagem livre, sem modelo); 3 e 7 dias já exigem modelo aprovado.
 */
export interface FollowUpStageDef {
  stage: number;
  afterHours: number;
  kind: "text" | "template";
  /** Só pra kind "template" — nome da env var com o modelo aprovado desse estágio (cada estágio tem o seu, com texto diferente). */
  templateEnvVar?: string;
}
export const AUTO_FOLLOW_UP_STAGES: FollowUpStageDef[] = [
  { stage: 1, afterHours: 23, kind: "text" },
  { stage: 2, afterHours: 72, kind: "template", templateEnvVar: "ASSISTANT_FOLLOWUP_3D_TEMPLATE" },
  { stage: 3, afterHours: 168, kind: "template", templateEnvVar: "ASSISTANT_FOLLOWUP_7D_TEMPLATE" },
];

/** Estágio de retomada automática pendente agora, ou null. Pega o mais avançado (ex.: cron ficou fora do ar e pulou um estágio). */
export function dueFollowUpStage(silentHours: number, currentStage: number): FollowUpStageDef | null {
  let due: FollowUpStageDef | null = null;
  for (const def of AUTO_FOLLOW_UP_STAGES) if (def.stage > currentStage && silentHours >= def.afterHours) due = def;
  return due;
}

/** Texto da retomada automática por estágio (23h / 3 dias / 7 dias) — tom diferente a cada tentativa, a última já fecha a porta. */
export function autoFollowUpMessage(leadName: string | null | undefined, stage: number): string {
  const name = firstName(leadName);
  const hi = `Oi${name ? `, ${name}` : ""}!`;
  if (stage === 1) return `${hi} Vi que ainda não conseguiu ver minha mensagem 😊 Ficou alguma dúvida? Se quiser, te explico rapidinho por aqui.`;
  if (stage === 2) return `${hi} Passando só pra saber se ainda faz sentido a gente conversar sobre o marketing da sua empresa. Se agora não for um bom momento, sem problema algum.`;
  return `${hi} Vou parar de insistir por aqui pra não incomodar 😊 Se mais pra frente fizer sentido falar sobre marketing pra sua empresa, é só me chamar que seguimos de onde paramos.`;
}

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
