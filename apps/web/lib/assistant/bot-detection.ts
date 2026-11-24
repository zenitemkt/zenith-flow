/**
 * Robô de atendimento do outro lado (menu automático de outra empresa), detectado por regra fixa no webhook,
 * antes da IA e antes de a resposta da prospecção virar lead. A ferramenta `detected_bot` da Milena continua
 * cobrindo os casos que a regra não pega.
 *
 * Mensagem de saudação/ausência ("obrigado pelo contato, já retornamos") NÃO conta: muitas empresas pequenas
 * usam a saudação automática do WhatsApp Business e depois uma pessoa responde.
 */

/** Frases que só um menu automático escreve (comparadas sem acento e em minúsculas). */
const MENU_PATTERNS: RegExp[] = [
  /\b(mensagem|opcao|resposta|entrada) (invalida|nao reconhecida)/,
  /\b(selecione|escolha) (uma|a|o|um)? ?(das |dos )?(opcoes|opcao|setor|setores|departamento|departamentos|alternativas?)\b/,
  /\b(clique|toque) (em )?(um|uma|no|na)? ?(dos |das )?(botoes|botao|opcoes|opcao)\b/,
  /\b(com qual|para qual|qual) (setor|departamento|area) (voce )?(gostaria|deseja|quer)/,
  /\b(digite|responda com) (apenas |somente )?(o numero|a opcao|um numero|o codigo)/,
  /\b(atendimento|mensagem|resposta) automatic[ao]\b/,
  /\bsou (o|a) (assistente|atendente) virtual\b/,
  /\bmenu (principal|de opcoes|inicial)\b/,
  /\bpara voltar ao menu\b/,
];

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function looksLikeMenuText(text: string): boolean {
  const t = normalize(text);
  return t.length > 0 && MENU_PATTERNS.some((re) => re.test(t));
}

export interface InboundForDetection {
  /** Tipo da mensagem na API do WhatsApp (text, unsupported, interactive...). */
  type: string;
  content: string;
}

/**
 * `recentInbound`: textos recebidos antes nesta conversa (mais recentes primeiro).
 * `prospect`: conversa aberta pela prospecção, ou seja, fomos nós que escrevemos para uma empresa.
 */
export function detectCounterpartBot(message: InboundForDetection, opts: { prospect: boolean; recentInbound: string[] }): string | null {
  // Menu com botões/lista de outra empresa chega pela API como "unsupported". Numa conversa de prospecção
  // (nós escrevemos pra uma empresa), isso é praticamente sempre o robô de atendimento dela.
  if (message.type === "unsupported" && opts.prospect) return "menu com botões";
  if (message.type !== "text") return null;
  if (looksLikeMenuText(message.content)) return "mensagem de menu automático";
  // Mesma mensagem longa repetida = resposta automática em loop.
  const current = normalize(message.content);
  if (current.length >= 20 && opts.recentInbound.slice(0, 3).some((previous) => normalize(previous) === current)) return "mensagem automática repetida";
  return null;
}
