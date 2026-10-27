/**
 * Configuração da assistente virtual de WhatsApp (Milena). Fica em
 * `AssistantSettings.config` e é editada pelo painel /automacoes/assistente.
 * Os valores padrão são as regras combinadas com o Gabriel em 2026-10-26/27.
 */
export interface AssistantConfig {
  name: string;
  model: string;
  /** Espera, em segundos, depois da ÚLTIMA mensagem da pessoa antes de responder. */
  replyDelaySeconds: number;
  icp: {
    minAdBudget: number;
    minManagementFee: number;
    preferredRegion: string;
    preferPhysicalBusiness: boolean;
    notes: string;
  };
  entryProduct: {
    name: string;
    description: string;
    priceCard: number;
    maxInstallments: number;
    pricePix: number;
    deliveryBusinessDays: number;
    training: string;
    suggestedAdBudget: number;
  };
  meeting: {
    durationMinutes: number;
    pitch: string;
    weekdays: number[]; // 0 = domingo
    morning: { start: string; end: string };
    afternoon: { start: string; end: string };
    saturdayMorningOnly: boolean;
    preferMorning: boolean;
    partnerApprovalUnderHours: number;
    partnerApprovalTimeoutMinutes: number;
    calendarIds: string[];
  };
  reminders: {
    confirmHoursBefore: number;
    sendStartNotice: boolean;
  };
  conversation: {
    guaranteeOnlyIfAsked: boolean;
    guaranteeText: string;
    neverDiscussManagementPrice: boolean;
    useSpin: boolean;
    dismissSellers: boolean;
    extraInstructions: string;
  };
  notifications: {
    groupId: string;
    partnerPhones: string[];
    onNewContact: boolean;
    onHumanRequest: boolean;
    onBooking: boolean;
    onCancellation: boolean;
  };
  payment: {
    provider: string;
    pixKey: string;
    pixConfirmation: "gateway" | "manual";
  };
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  name: "Milena",
  model: "claude-sonnet-5-5",
  replyDelaySeconds: 120,
  icp: {
    minAdBudget: 800,
    minManagementFee: 1200,
    preferredRegion: "Americana e região",
    preferPhysicalBusiness: true,
    notes: "Sem restrição de segmento. Preferência por negócios físicos de Americana e região.",
  },
  entryProduct: {
    name: "START",
    description:
      "Para quem vai anunciar pela primeira vez. A gente organiza o Instagram e o Facebook para passar uma imagem profissional, cria o Perfil da Empresa no Google e sobe as primeiras campanhas de conversão na Meta ou no Google. Depois ensina o gerenciamento básico para a pessoa tocar sozinha, sem pagar gestão todo mês. Quando o faturamento crescer, ela pode contratar a gestão mensal para escalar e se dedicar à operação.",
    priceCard: 1500,
    maxInstallments: 12,
    pricePix: 1200,
    deliveryBusinessDays: 7,
    training:
      "Um encontro ao vivo de cerca de 2 horas, no ritmo da pessoa, ensinando o gerenciamento básico: orçamento, subir criativo novo e o dia a dia das campanhas.",
    suggestedAdBudget: 500,
  },
  meeting: {
    durationMinutes: 30,
    pitch: "Uma reunião rápida, de no máximo 30 minutos, pelo Google Meet, para entender o seu negócio e a sua necessidade.",
    weekdays: [1, 2, 3, 4, 5, 6],
    morning: { start: "08:00", end: "12:00" },
    afternoon: { start: "13:30", end: "17:00" },
    saturdayMorningOnly: true,
    preferMorning: true,
    partnerApprovalUnderHours: 24,
    partnerApprovalTimeoutMinutes: 30,
    calendarIds: [],
  },
  reminders: {
    confirmHoursBefore: 2,
    sendStartNotice: true,
  },
  conversation: {
    guaranteeOnlyIfAsked: true,
    guaranteeText:
      "Se a empresa contratar a gestão e não gostar do primeiro mês, pode pedir o reembolso do valor do mês. No primeiro mês o contrato não tem multa de cancelamento.",
    neverDiscussManagementPrice: true,
    useSpin: true,
    dismissSellers: true,
    extraInstructions: "",
  },
  notifications: {
    groupId: "",
    partnerPhones: [],
    onNewContact: true,
    onHumanRequest: true,
    onBooking: true,
    onCancellation: true,
  },
  payment: {
    provider: "",
    pixKey: "",
    pixConfirmation: "gateway",
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Mescla o que está salvo com os padrões, campo a campo, ignorando tipos errados. */
export function mergeAssistantConfig(stored: unknown): AssistantConfig {
  const merge = (base: unknown, incoming: unknown): unknown => {
    if (isObject(base)) {
      const out: Record<string, unknown> = { ...base };
      if (isObject(incoming)) for (const key of Object.keys(base)) out[key] = merge(base[key], incoming[key]);
      return out;
    }
    if (Array.isArray(base)) return Array.isArray(incoming) ? incoming : base;
    return typeof incoming === typeof base ? incoming : base;
  };
  return merge(DEFAULT_ASSISTANT_CONFIG, stored) as AssistantConfig;
}
