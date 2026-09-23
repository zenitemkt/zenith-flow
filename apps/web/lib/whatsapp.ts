/** Contexto é todo pt-BR/BRL — assume DDI 55 quando o número vem sem código de país. */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Mensagem padrão pros links manuais de WhatsApp — cada fluxo escreve sua própria intro. */
export function buildWhatsappMessage(intro: string, url: string): string {
  return `${intro} ${url}`;
}
