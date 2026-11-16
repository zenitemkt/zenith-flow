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

/** Sugestão de primeira mensagem a partir das respostas do formulário (a pessoa edita antes de mandar). */
export function suggestOpener(input: { leadName: string | null; senderName: string | null; service: string | null; city: string | null; summary: string | null }) {
  const name = firstName(input.leadName);
  const sender = firstName(input.senderName);
  const instagram = input.summary?.match(/@[A-Za-z0-9._]{2,30}/)?.[0] ?? null;
  const service = input.service?.trim() ? lower(input.service.trim()) : null;
  const city = input.city?.trim() && !/^cidade\s*\d+$/i.test(input.city.trim()) ? input.city.trim() : null;

  const hello = `Oi${name ? `, ${name}` : ""}, tudo bem? Aqui é ${sender ? `o ${sender}` : "a equipe"}, da Zenite.`;
  const interest = service
    ? `Vi que você se interessou por ${service}${city ? ` pro seu negócio aí em ${city}` : ""}.`
    : `Vi que você preencheu nosso formulário${city ? ` aí de ${city}` : ""}.`;
  const look = instagram ? ` Já dei uma olhada no ${instagram}.` : "";
  return `${hello} ${interest}${look} Posso te fazer umas perguntas rápidas pra entender melhor o que você precisa?`;
}
