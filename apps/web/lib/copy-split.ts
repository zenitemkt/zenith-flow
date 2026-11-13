/**
 * Separa textos colados de uma vez nas opções do anúncio (a Meta aceita até 5 de cada).
 * Textos principais: separados por linha "---" (ou ===, ***), por numeração no começo da
 * linha ("1.", "2)", "Texto 3:", "Opção 4 -") ou, sem nada disso, por duas linhas em branco.
 * Títulos e descrições: um por linha (tira marcadores e numeração).
 */
const SEPARATOR = /^\s*(-{3,}|={3,}|\*{3,}|_{3,}|•{3,})\s*$/;
const NUMBERED = /^\s*(?:(?:texto|op[cç][aã]o|varia[cç][aã]o|copy|t[ií]tulo|descri[cç][aã]o)\s*)?\d{1,2}\s*[.):\-–]\s*/i;

export function splitPrimaryTexts(raw: string, max = 5): string[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  let blocks: string[];
  if (lines.some((l) => SEPARATOR.test(l))) {
    blocks = text.split(/^\s*(?:-{3,}|={3,}|\*{3,}|_{3,}|•{3,})\s*$/m);
  } else if (lines.filter((l) => NUMBERED.test(l)).length >= 2 && NUMBERED.test(lines[0]!)) {
    blocks = [];
    for (const line of lines) {
      if (NUMBERED.test(line)) blocks.push(line.replace(NUMBERED, ""));
      else blocks[blocks.length - 1] += `\n${line}`;
    }
  } else {
    blocks = text.split(/\n\s*\n\s*\n+/);
  }
  return blocks.map((b) => b.trim()).filter(Boolean).slice(0, max);
}

export function splitLines(raw: string, max = 5): string[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*–]\s+/, "").replace(NUMBERED, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export const DEFAULT_URL_TAGS = "utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}";
