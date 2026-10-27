// Vícios de escrita de IA (artigo da Envox): a regra principal está no prompt; aqui ficam os consertos
// mecânicos aplicados em toda resposta antes de ir para o WhatsApp.

export function humanize(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/;\s+(\p{Ll})/gu, (_m, letter: string) => `. ${letter.toUpperCase()}`)
    .replace(/;/g, ",")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Quebra a resposta nas mensagens que o modelo separou com "---" (e corta blocos longos por parágrafo). */
export function splitBubbles(text: string, maxChars = 320): string[] {
  const parts = text.split(/^\s*---\s*$/m).map((part) => humanize(part)).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length <= maxChars) {
      out.push(part);
      continue;
    }
    for (const paragraph of part.split(/\n{2,}/)) if (paragraph.trim()) out.push(paragraph.trim());
  }
  return out.slice(0, 4);
}
