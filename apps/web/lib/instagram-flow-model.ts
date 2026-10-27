/**
 * Sequências do mini-chat de Instagram — formato dos passos e regras puras
 * (sem banco nem Meta), usadas pela API, pelo motor e pela tela.
 *
 * O passo 0 é sempre uma mensagem e espelha `responseText`/`buttons` da
 * regra. Cada passo aponta pro próximo por id (`null` = encerra), então dá
 * pra ramificar: resposta rápida, palavra da resposta e "segue o perfil?"
 * levam cada um pra um passo diferente.
 */

export interface FlowButton {
  text: string;
  url: string;
}

export interface FlowQuickReply {
  title: string;
  next: string | null;
}

export interface FlowBranch {
  /** Basta conter uma delas (sem diferenciar maiúsculas). */
  keywords: string[];
  next: string | null;
}

export type FlowStep =
  | {
      id: string;
      type: "message";
      text: string;
      buttons: FlowButton[];
      quickReplies: FlowQuickReply[];
      /** Mostra "digitando..." por um tempo proporcional ao tamanho do texto (atraso inteligente). */
      typing: boolean;
      /** Sem respostas rápidas: segue direto. Com elas: usado quando a pessoa digita algo que não é nenhuma das opções. */
      next: string | null;
    }
  | { id: string; type: "delay"; seconds: number; next: string | null }
  | {
      id: string;
      type: "input";
      /** Nome do campo onde a resposta fica salva no contato (ex.: email). */
      saveAs: string | null;
      validate: "any" | "email" | "phone" | "number";
      /** Mandada quando a resposta não passa na validação. */
      retryText: string | null;
      branches: FlowBranch[];
      next: string | null;
      /** Sem resposta depois desse tempo, vai pra `timeoutNext`. null = espera até a janela de 24h fechar. */
      timeoutMinutes: number | null;
      timeoutNext: string | null;
    }
  | { id: string; type: "tag"; add: string[]; remove: string[]; next: string | null }
  | { id: string; type: "follows"; yes: string | null; no: string | null };

export type FlowStepType = FlowStep["type"];

export const FLOW_LIMITS = {
  steps: 30,
  quickReplies: 13,
  buttons: 3,
  branches: 10,
  /** A Meta só deixa mandar mensagem até 24h depois da última mensagem da pessoa. */
  maxDelaySeconds: 23 * 60 * 60,
  /** Atraso até esse valor roda na hora (dentro do webhook); acima disso vai pro agendador de minuto em minuto. */
  inlineDelaySeconds: 15,
  /** Proteção contra laço infinito (passo apontando pra si mesmo sem esperar nada). */
  maxStepsPerRun: 25,
} as const;

export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function strList(value: unknown, max: number, maxItems: number): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return list
    .map((item) => str(item, max))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function num(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/** Nome de campo vira chave simples: "E-mail do lead" → "e_mail_do_lead". */
export function normalizeFieldName(value: unknown): string | null {
  const raw = str(value, 40);
  if (!raw) return null;
  const key = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || null;
}

/**
 * Valida e limpa o que veio da tela. Ids que apontam pra passo inexistente
 * viram `null` (encerra). Devolve `null` quando não há nenhum passo válido.
 */
export function parseFlow(value: unknown): FlowStep[] | null {
  const raw = Array.isArray(value) ? value : Array.isArray((value as { steps?: unknown })?.steps) ? (value as { steps: unknown[] }).steps : null;
  if (!raw) return null;

  const ids = new Set<string>();
  const drafts = raw.slice(0, FLOW_LIMITS.steps).filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  for (const item of drafts) {
    const id = str(item.id, 40);
    if (id) ids.add(id);
  }
  const ref = (value: unknown): string | null => {
    const id = str(value, 40);
    return id && ids.has(id) ? id : null;
  };

  const steps: FlowStep[] = [];
  const seen = new Set<string>();
  for (const item of drafts) {
    const id = str(item.id, 40);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const type = steps.length === 0 ? "message" : item.type;
    if (type === "message") {
      const text = str(item.text, 1000);
      if (!text) continue;
      const buttons = (Array.isArray(item.buttons) ? item.buttons : [])
        .map((b: { text?: unknown; url?: unknown }) => ({ text: str(b?.text, 20), url: str(b?.url, 500) }))
        .filter((b): b is FlowButton => Boolean(b.text && b.url))
        .slice(0, FLOW_LIMITS.buttons);
      const quickReplies =
        buttons.length > 0
          ? []
          : (Array.isArray(item.quickReplies) ? item.quickReplies : [])
              .map((q: { title?: unknown; next?: unknown }) => ({ title: str(q?.title, 20), next: ref(q?.next) }))
              .filter((q): q is FlowQuickReply => Boolean(q.title))
              .slice(0, FLOW_LIMITS.quickReplies);
      steps.push({ id, type: "message", text, buttons, quickReplies, typing: item.typing !== false, next: ref(item.next) });
    } else if (type === "delay") {
      steps.push({ id, type: "delay", seconds: num(item.seconds, 1, FLOW_LIMITS.maxDelaySeconds) ?? 60, next: ref(item.next) });
    } else if (type === "input") {
      const validate = ["email", "phone", "number"].includes(item.validate as string) ? (item.validate as "email" | "phone" | "number") : "any";
      const branches = (Array.isArray(item.branches) ? item.branches : [])
        .map((b: { keywords?: unknown; next?: unknown }) => ({ keywords: strList(b?.keywords, 60, 20), next: ref(b?.next) }))
        .filter((b) => b.keywords.length > 0)
        .slice(0, FLOW_LIMITS.branches);
      steps.push({
        id,
        type: "input",
        saveAs: normalizeFieldName(item.saveAs),
        validate,
        retryText: str(item.retryText, 500),
        branches,
        next: ref(item.next),
        timeoutMinutes: num(item.timeoutMinutes, 1, FLOW_LIMITS.maxDelaySeconds / 60),
        timeoutNext: ref(item.timeoutNext),
      });
    } else if (type === "tag") {
      steps.push({ id, type: "tag", add: strList(item.add, 40, 10), remove: strList(item.remove, 40, 10), next: ref(item.next) });
    } else if (type === "follows") {
      steps.push({ id, type: "follows", yes: ref(item.yes), no: ref(item.no) });
    }
  }
  if (steps.length === 0 || steps[0]!.type !== "message") return null;

  // Passos descartados acima podem ter deixado referências soltas.
  const kept = new Set(steps.map((step) => step.id));
  const fix = (id: string | null) => (id && kept.has(id) ? id : null);
  return steps.map((step) => {
    switch (step.type) {
      case "message":
        return { ...step, next: fix(step.next), quickReplies: step.quickReplies.map((q) => ({ ...q, next: fix(q.next) })) };
      case "input":
        return { ...step, next: fix(step.next), timeoutNext: fix(step.timeoutNext), branches: step.branches.map((b) => ({ ...b, next: fix(b.next) })) };
      case "follows":
        return { ...step, yes: fix(step.yes), no: fix(step.no) };
      default:
        return { ...step, next: fix(step.next) };
    }
  });
}

/** Uma sequência só vale a pena guardar se fizer mais do que a mensagem única de sempre. */
export function isTrivialFlow(steps: FlowStep[]): boolean {
  const first = steps[0];
  return steps.length === 1 && first?.type === "message" && first.quickReplies.length === 0;
}

export function stepById(steps: FlowStep[], id: string | null | undefined): FlowStep | null {
  if (!id) return null;
  return steps.find((step) => step.id === id) ?? null;
}

/** "digitando..." proporcional ao texto: ~40 caracteres por segundo, entre 1 e 4 segundos. */
export function typingDelayMs(text: string): number {
  return Math.min(4000, Math.max(1000, Math.round((text.length / 40) * 1000)));
}

/** Troca {{nome}}, {{usuario}} e {{campo}} pelos dados do contato; variável sem valor some. */
export function renderTemplate(text: string, contact: { name: string | null; username: string | null; fields: Record<string, string> }): string {
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, rawKey: string) => {
    const key = rawKey.toLowerCase();
    if (key === "nome" || key === "primeiro_nome") {
      const name = contact.name ?? contact.username ?? "";
      return key === "primeiro_nome" ? (name.split(/\s+/)[0] ?? "") : name;
    }
    if (key === "usuario") return contact.username ? `@${contact.username}` : "";
    return contact.fields[key] ?? "";
  });
}

export function validateAnswer(answer: string, rule: "any" | "email" | "phone" | "number"): string | null {
  const trimmed = answer.trim();
  if (!trimmed) return null;
  if (rule === "email") {
    const match = trimmed.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    return match ? match[0].toLowerCase() : null;
  }
  if (rule === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13 ? digits : null;
  }
  if (rule === "number") {
    const match = trimmed.replace(",", ".").match(/-?\d+(\.\d+)?/);
    return match ? match[0] : null;
  }
  return trimmed.slice(0, 500);
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Ramo cuja palavra aparece na resposta (sem acento e sem diferenciar maiúsculas). */
export function pickBranch(branches: FlowBranch[], answer: string): FlowBranch | null {
  const normalized = normalizeForMatch(answer);
  return branches.find((branch) => branch.keywords.some((keyword) => normalized.includes(normalizeForMatch(keyword)))) ?? null;
}

/** Resposta rápida pelo payload (`qr:<índice>`) ou, se a pessoa digitou, pelo título exato. */
export function pickQuickReply(quickReplies: FlowQuickReply[], input: { payload: string | null; text: string | null }): FlowQuickReply | null {
  const match = input.payload?.match(/^qr:(\d+)$/);
  if (match) return quickReplies[Number(match[1])] ?? null;
  const text = input.text ? normalizeForMatch(input.text) : "";
  return text ? (quickReplies.find((reply) => normalizeForMatch(reply.title) === text) ?? null) : null;
}
