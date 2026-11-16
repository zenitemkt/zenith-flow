/** Primeiro contato manual (pelo celular do número comercial) com quem virou lead e não chamou no WhatsApp. */

export const firstName = (name: string | null | undefined) => {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
};

/** Só dígitos, com 55 na frente quando vier sem DDI. */
export const waPhone = (raw: string | null | undefined) => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 ? digits : null;
};

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Sugestão de primeira mensagem, já como a Milena (a equipe envia pelo celular e a Milena segue
 * dali sem se apresentar de novo). Usa as respostas do formulário e termina com uma pergunta fácil.
 */
export function suggestOpener(input: { leadName: string | null; service: string | null; city: string | null; summary: string | null }) {
  const name = firstName(input.leadName);
  const instagram = input.summary?.match(/@[A-Za-z0-9._]{2,30}/)?.[0] ?? null;
  const service = input.service?.trim() ? lower(input.service.trim()) : null;
  const city = input.city?.trim() && !/^cidade\s*\d+$/i.test(input.city.trim()) ? input.city.trim() : null;

  const hello = `Oi${name ? `, ${name}` : ""}, tudo bem? Aqui é a Milena, do pré-vendas da Zenite.`;
  const interest = service
    ? `Vi que você se interessou por ${service}${city ? ` pro seu negócio aí em ${city}` : ""}.`
    : `Recebi seu contato pelo nosso formulário${city ? ` aí de ${city}` : ""}.`;
  const look = instagram ? ` Dei uma olhada no ${instagram}.` : "";
  const question = instagram ? " Me conta: hoje seus clientes chegam mais pelo Instagram ou por indicação?" : " Me conta: hoje como seus clientes costumam chegar até você?";
  return `${hello} ${interest}${look}${question}`;
}
