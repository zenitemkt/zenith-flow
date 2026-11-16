/** Primeira mensagem da Milena para quem preencheu formulário e não chamou no WhatsApp (modelo aprovado na Meta). */
export const FORM_TEMPLATE_NAME = process.env.ASSISTANT_FORM_TEMPLATE || "milena_formulario";

export const FORM_TEMPLATE_TEXT = (name: string, topic: string) =>
  `Oi, ${name}! Aqui é a Milena, da Zenite. Vi que você pediu informações sobre ${topic} no nosso anúncio. Quero entender um pouco do seu negócio pra ver como a gente pode ajudar. Posso te fazer umas perguntas rápidas?`;

export const firstName = (name: string | null | undefined) => {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "tudo bem";
};

/** "Gestão de Marketing completa" vira "gestão de marketing completa" (cabe no meio da frase). */
export const topicOf = (service: string | null | undefined) => {
  const s = (service ?? "").trim();
  if (!s) return "marketing para o seu negócio";
  return s.charAt(0).toLowerCase() + s.slice(1);
};

/** Só dígitos, com 55 na frente quando vier sem DDI. */
export const waPhone = (raw: string | null | undefined) => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 ? digits : null;
};
