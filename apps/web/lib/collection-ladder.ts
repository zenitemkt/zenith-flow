import { startOfDayUTC } from "./dates";

/**
 * Seção 28 do manual: "Régua de cobrança e inadimplência" — momento em
 * relação ao vencimento (D-5, D0, D+1, D+3, D+7, D+15) define ação padrão e
 * status/efeito. Modelado como faixas (não dias exatos) porque o cálculo é
 * sob demanda, não um job diário disparando exatamente em cada D — uma
 * fatura vista em D+2 ainda deve cair no mesmo estágio de D+1.
 *
 * "Health financeiro reduz" e "Risco de churn/crédito aumenta" (efeitos das
 * linhas D+3/D+7 da tabela do manual) já acontecem de verdade nesta base —
 * são os sinais de fatura atrasada do Health Score e do Risco de Churn. Este
 * módulo não duplica esse cálculo, só visualiza o estágio da régua.
 *
 * "Notificar financeiro e gestor" (D+3) e "escalonar" (D+7) não têm canal
 * real de envio ainda (e-mail/SMS/WhatsApp são pendência de Fase 2/3) — a
 * régua em si, visível pra equipe, é a notificação hoje. Suspensão (D+15)
 * nunca é automática — o próprio manual pede grace period e autorização
 * humana, então esta fatia não implementa nenhuma ação automática, só
 * mostra o estágio e permite criar uma tarefa de acompanhamento manual.
 */
export type CollectionStage = "LEMBRETE" | "VENCIMENTO" | "ATRASO_1" | "ATRASO_3" | "ESCALONAR" | "RECUPERACAO";

export const COLLECTION_STAGE_LABELS: Record<CollectionStage, string> = {
  LEMBRETE: "Lembrete (D-5)",
  VENCIMENTO: "Vencimento (D0)",
  ATRASO_1: "Primeiro atraso (D+1)",
  ATRASO_3: "Segundo contato (D+3)",
  ESCALONAR: "Escalonar (D+7)",
  RECUPERACAO: "Plano de recuperação (D+15)",
};

export const COLLECTION_STAGE_BADGE_CLASS: Record<CollectionStage, string> = {
  LEMBRETE: "bg-[#F2F4F7] text-[#475467]",
  VENCIMENTO: "bg-[#EEF2FF] text-[#3730A3]",
  ATRASO_1: "bg-[#FEF3C7] text-[#92600A]",
  ATRASO_3: "bg-[#FEF3C7] text-[#92600A]",
  ESCALONAR: "bg-[#FEE4E2] text-[#B42318]",
  RECUPERACAO: "bg-[#FEE4E2] text-[#B42318]",
};

/** A tarefa de acompanhamento só faz sentido a partir do primeiro atraso real. */
export const COLLECTION_TASK_ELIGIBLE_STAGES: CollectionStage[] = ["ATRASO_1", "ATRASO_3", "ESCALONAR", "RECUPERACAO"];

/**
 * Retorna o estágio da régua para um vencimento, ou `null` se a fatura ainda
 * está fora da janela (mais de 5 dias antes do vencimento).
 */
export function collectionStageForDueDate(dueDate: Date, today: Date = new Date()): CollectionStage | null {
  const dueDay = startOfDayUTC(dueDate).getTime();
  const todayDay = startOfDayUTC(today).getTime();
  const daysOverdue = Math.round((todayDay - dueDay) / (24 * 60 * 60 * 1000));

  if (daysOverdue < -5) return null;
  if (daysOverdue < 0) return "LEMBRETE";
  if (daysOverdue === 0) return "VENCIMENTO";
  if (daysOverdue <= 2) return "ATRASO_1";
  if (daysOverdue <= 6) return "ATRASO_3";
  if (daysOverdue <= 14) return "ESCALONAR";
  return "RECUPERACAO";
}

export function daysOverdue(dueDate: Date, today: Date = new Date()): number {
  const dueDay = startOfDayUTC(dueDate).getTime();
  const todayDay = startOfDayUTC(today).getTime();
  return Math.round((todayDay - dueDay) / (24 * 60 * 60 * 1000));
}
