/**
 * Textos da prospecção. Variáveis: {empresa}, {nicho}, {cidade}, {gancho}. O {gancho} é montado por
 * empresa a partir do que o Google Maps mostra (sem site, nota, nº de avaliações).
 */
export interface ProspectCopyInput {
  name: string;
  segment: string;
  city: string;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
}

const cityName = (city: string) => city.split(",")[0]!.trim();

/** Gancho curto, pra primeira mensagem de WhatsApp. */
export function whatsappHook(p: ProspectCopyInput): string {
  if (!p.website) return "Vi que vocês ainda não têm site próprio.";
  if (p.rating !== null && p.rating < 4.5) return "Dei uma olhada no perfil de vocês no Google e tenho uma ideia pra trazer mais clientes por lá.";
  if ((p.reviewCount ?? 0) > 0) return `Vi que vocês têm ${p.reviewCount} avaliações no Google.`;
  return "Dei uma olhada no perfil de vocês no Google.";
}

/** Gancho de e-mail, um pouco mais explicado. */
export function emailHook(p: ProspectCopyInput): string {
  const city = cityName(p.city);
  if (!p.website) return `Vi que a ${p.name} ainda não tem site próprio. Quem pesquisa ${p.segment} em ${city} no Google costuma clicar em quem aparece com site e avaliações.`;
  if (p.rating !== null && p.rating < 4.5) return `A ${p.name} tem nota ${p.rating.toLocaleString("pt-BR")} no Google. Melhorar avaliações e perfil costuma trazer mais ligações sem aumentar o gasto com anúncio.`;
  return `A ${p.name} já tem ${p.reviewCount ?? 0} avaliações no Google. Dá pra transformar essa presença em mais clientes com anúncios bem direcionados.`;
}

export function renderCopy(template: string, p: ProspectCopyInput, hook: string): string {
  return template
    .replaceAll("{empresa}", p.name)
    .replaceAll("{nicho}", p.segment)
    .replaceAll("{cidade}", cityName(p.city))
    .replaceAll("{gancho}", hook)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const DEFAULT_WHATSAPP_OPENER =
  "Oi, tudo bem? Aqui é a Milena, da Zenite, agência de marketing de Americana. Encontrei a {empresa} no Google Maps. {gancho} Posso te fazer uma pergunta rápida sobre como os clientes chegam até vocês hoje?";

export const DEFAULT_EMAIL_STEPS: { subject: string; body: string }[] = [
  {
    subject: "{empresa} no Google",
    body: "Olá, tudo bem?\n\nAqui é a Milena, da Zenite, agência de marketing de Americana. Encontrei a {empresa} no Google Maps procurando {nicho} em {cidade}.\n\n{gancho}\n\nA gente ajuda empresas da região a receber mais contatos pelo Google e pelo Instagram. Posso te mandar um diagnóstico rápido e gratuito do que dá pra melhorar?\n\nAbraço,\nMilena | Zenite Marketing",
  },
  {
    subject: "Re: {empresa} no Google",
    body: "Olá, passando pra saber se você viu meu e-mail.\n\nEm 15 minutos mostramos o que está tirando clientes da {empresa} no Google e no Instagram, e o que dá pra ajustar primeiro. Sem custo.\n\nSe fizer sentido, é só responder este e-mail com um horário bom pra você.\n\nAbraço,\nMilena | Zenite Marketing",
  },
];
