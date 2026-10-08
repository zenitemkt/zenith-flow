import type { LeadSiteActivity } from "./tracking-activity";

export type LeadTemperature = "BAIXO" | "MEDIO" | "ALTO";

export interface LeadSignal {
  id: string;
  label: string;
  detail: string;
  tone: "attention" | "hot";
}

export interface LeadIntelligence {
  score: number;
  temperature: LeadTemperature;
  signals: LeadSignal[];
}

interface IntelligenceContext {
  activity: LeadSiteActivity;
  isClient: boolean;
  latestWonAt: Date | null;
  latestProposalAt: Date | null;
}

export function calculateLeadIntelligence(context: IntelligenceContext): LeadIntelligence {
  const { activity } = context;
  const score = Math.min(
    100,
    Math.min(activity.formSubmitsCount, 1) * 35 +
      Math.min(activity.whatsappClicksCount, 1) * 20 +
      Math.min(activity.formStartsCount, 1) * 10 +
      Math.min(activity.serviceViewsCount, 3) * 8 +
      Math.min(Math.max(activity.visitsCount - 1, 0), 3) * 5,
  );
  const signals: LeadSignal[] = [];

  if (activity.formStartsCount > activity.formSubmitsCount) {
    signals.push({
      id: "form-abandon",
      label: "Formulário não concluído",
      detail: "Começou a preencher, mas ainda não enviou.",
      tone: "attention",
    });
  }
  if (activity.visitsCount > 1) {
    signals.push({
      id: "returning",
      label: "Lead retornou ao site",
      detail: `${activity.visitsCount} visitas identificadas na jornada.`,
      tone: "hot",
    });
  }
  if (activity.serviceViewsCount >= 3) {
    signals.push({
      id: "services",
      label: "Alto interesse em serviços",
      detail: `${activity.serviceViewsCount} visualizações de páginas de serviço.`,
      tone: "hot",
    });
  }
  if (context.isClient && activity.lastActivityAt && (!context.latestWonAt || activity.lastActivityAt > context.latestWonAt)) {
    signals.push({
      id: "client-return",
      label: "Cliente voltou a demonstrar interesse",
      detail: "Há atividade no site depois da última negociação ganha.",
      tone: "hot",
    });
  }
  if (context.latestProposalAt && activity.lastActivityAt && activity.lastActivityAt > context.latestProposalAt) {
    signals.push({
      id: "after-proposal",
      label: "Lead voltou após a proposta",
      detail: "Nova atividade detectada depois da movimentação mais recente da proposta.",
      tone: "hot",
    });
  }

  return {
    score,
    temperature: score >= 60 ? "ALTO" : score >= 30 ? "MEDIO" : "BAIXO",
    signals,
  };
}
