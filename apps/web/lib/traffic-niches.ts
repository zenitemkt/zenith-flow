/**
 * Modelos de nicho do Gestor de tráfego: ponto de partida editável para o conjunto e o formulário.
 * Os interesses são termos de busca (os IDs vêm da Meta na hora, pela busca de interesses).
 */
export interface NichePreset {
  niche: string;
  interestTerms: string[];
  introTitle: string;
  introText: string;
  questions: { label: string; options: string[] }[];
}

const COMMON_QUESTIONS = [
  { label: "Quanto você investe hoje por mês em anúncios?", options: ["Ainda não invisto", "Até R$ 500", "De R$ 500 a R$ 1.500", "Mais de R$ 1.500"] },
];

export const NICHE_PRESETS: NichePreset[] = [
  {
    niche: "Imobiliárias",
    interestTerms: ["Imobiliária", "Corretor de imóveis", "Mercado imobiliário"],
    introTitle: "Mais contatos para a sua imobiliária",
    introText: "A Zenite cuida dos anúncios de imobiliárias da região para trazer contatos de quem quer comprar ou alugar. Responda 3 perguntas e a nossa equipe fala com você.",
    questions: [{ label: "Quantos corretores trabalham na imobiliária?", options: ["Só eu", "2 a 5", "6 a 15", "Mais de 15"] }, ...COMMON_QUESTIONS],
  },
  {
    niche: "Salões de beleza e barbearias",
    interestTerms: ["Salão de beleza", "Barbearia", "Cabeleireiro"],
    introTitle: "Agenda cheia no seu salão",
    introText: "A Zenite faz anúncios para salões e barbearias da região trazerem clientes novos durante a semana toda. Responda 3 perguntas e a nossa equipe fala com você.",
    questions: [{ label: "Quantos profissionais atendem no espaço?", options: ["Só eu", "2 a 4", "5 a 10", "Mais de 10"] }, ...COMMON_QUESTIONS],
  },
  {
    niche: "Clínicas médicas",
    interestTerms: ["Clínica médica", "Medicina", "Consultório"],
    introTitle: "Mais pacientes para a sua clínica",
    introText: "A Zenite cuida dos anúncios de clínicas da região dentro das regras dos conselhos de classe. Responda 3 perguntas e a nossa equipe fala com você.",
    questions: [{ label: "Qual a especialidade principal da clínica?", options: [] }, ...COMMON_QUESTIONS],
  },
  {
    niche: "Funerárias",
    interestTerms: ["Funerária", "Plano funerário", "Cemitério"],
    introTitle: "Mais procura pelos seus planos",
    introText: "A Zenite faz anúncios para funerárias da região venderem planos com respeito e clareza. Responda 3 perguntas e a nossa equipe fala com você.",
    questions: [{ label: "A funerária vende plano funerário?", options: ["Sim", "Não", "Estamos começando"] }, ...COMMON_QUESTIONS],
  },
  {
    niche: "Lojas de carros",
    interestTerms: ["Concessionária", "Revenda de carros", "Carros seminovos"],
    introTitle: "Mais gente visitando a sua loja",
    introText: "A Zenite faz anúncios para lojas de carros da região trazerem compradores interessados no seu estoque. Responda 3 perguntas e a nossa equipe fala com você.",
    questions: [{ label: "Quantos carros a loja tem em estoque?", options: ["Até 20", "21 a 50", "51 a 100", "Mais de 100"] }, ...COMMON_QUESTIONS],
  },
];
