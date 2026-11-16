/**
 * Painel de demonstração do portal: tudo fictício, gerado a partir da data de hoje e guardado só
 * no navegador (localStorage). Nada aqui toca o banco do CRM. "Resetar painel" volta a este estado.
 */
export type ArtStatus = "pending" | "approved" | "changes";
export interface DemoArt {
  id: string;
  title: string;
  format: string;
  channel: string;
  caption: string;
  image: string;
  status: ArtStatus;
  note?: string;
  publishAt: string;
}
export interface DemoPost {
  id: string;
  title: string;
  channel: string;
  format: string;
  date: string;
  done: boolean;
  caption: string;
  image: string;
}
export interface DemoRequest {
  id: string;
  title: string;
  description: string;
  status: "open" | "progress" | "done";
  createdAt: string;
  updates: { at: string; author: string; text: string }[];
}
export interface DemoCampaign {
  id: string;
  name: string;
  status: "Ativa" | "Pausada" | "Encerrada";
  start: string;
  end: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  leads: number;
}
export interface DemoInvoice {
  id: string;
  month: string;
  amount: number;
  closing: string;
  due: string;
  status: "paid" | "open";
  paidAt?: string;
  method?: string;
}
export interface DemoFile {
  id: string;
  name: string;
  kind: "image" | "video" | "pdf";
  size: string;
  date: string;
}
export interface DemoState {
  version: 1;
  generatedAt: string;
  arts: DemoArt[];
  posts: DemoPost[];
  requests: DemoRequest[];
  graphics: DemoRequest[];
  campaigns: DemoCampaign[];
  invoices: DemoInvoice[];
  files: DemoFile[];
}

const day = (base: Date, offset: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Arte fictícia (SVG) com cara de post: degradê, título e marca. */
export function artImage(title: string, c1: string, c2: string, tag: string): string {
  // Quebra o título em linhas de ~16 caracteres (SVG não quebra texto sozinho).
  const lines: string[] = [];
  for (const word of title.split(" ")) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= 16) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const titleSvg = lines.map((line, i) => `<text x="90" y="${480 + i * 110}" font-family="Arial, sans-serif" font-size="96" font-weight="800" fill="#fff">${line}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#g)"/><circle cx="880" cy="260" r="260" fill="#fff" fill-opacity=".12"/><circle cx="160" cy="1180" r="200" fill="#fff" fill-opacity=".08"/><text x="90" y="200" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#fff" fill-opacity=".85" letter-spacing="6">${tag}</text>${titleSvg}<rect x="90" y="1150" width="320" height="90" rx="45" fill="#fff"/><text x="250" y="1208" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="${c1}">Saiba mais</text><text x="990" y="1290" text-anchor="end" font-family="Arial, sans-serif" font-size="34" fill="#fff" fill-opacity=".8">Demonstração</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildDemoState(now = new Date()): DemoState {
  const t = now;
  const month = (offset: number) => {
    const d = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };
  const monthDate = (offset: number, dayOfMonth: number) => new Date(t.getFullYear(), t.getMonth() + offset, dayOfMonth).toISOString().slice(0, 10);

  const names = [
    "[LEAD01] Avaliação Gratuita | Região de Americana",
    "[LEAD02] Promoção de Inverno | Americana e Santa Bárbara",
    "[LEAD03] Público Frio | Região de Americana",
    "[TRAF01] Perfil Instagram | Americana",
    "[LEAD04] Remarketing Site | Região de Americana",
    "[MSG01] WhatsApp Direto | Americana e Nova Odessa",
    "[LEAD05] Dia das Mães | Região de Americana",
    "[RECO01] Reconhecimento de Marca | Americana",
    "[LEAD06] Black Friday | Região de Americana",
    "[LEAD07] Lançamento de Serviço | Americana",
    "[LEAD08] Avaliação Gratuita | Região de Americana",
    "[MSG02] WhatsApp Direto | Americana e Sumaré",
    "[LEAD09] Público Semelhante | Região de Americana",
    "[TRAF02] Vídeo Institucional | Americana",
    "[LEAD10] Remarketing Engajados | Região de Americana",
  ];
  const statuses: DemoCampaign["status"][] = ["Encerrada", "Encerrada", "Encerrada", "Encerrada", "Encerrada", "Encerrada", "Encerrada", "Encerrada", "Encerrada", "Encerrada", "Ativa", "Ativa", "Ativa", "Pausada", "Ativa"];
  const campaigns: DemoCampaign[] = names.map((name, i) => {
    const active = statuses[i] !== "Encerrada";
    const spend = Math.round((active ? 900 : 1300) + ((i * 377) % 900));
    const reach = Math.round(spend * (11 + (i % 5)));
    const leads = Math.round(spend / (14 + (i % 7) * 2.3));
    return {
      id: `c${i + 1}`,
      name,
      status: statuses[i]!,
      start: day(t, -330 + i * 22),
      end: active ? null : day(t, -300 + i * 22),
      spend,
      reach,
      impressions: Math.round(reach * 2.4),
      clicks: Math.round(reach * 0.031),
      leads: name.includes("TRAF") || name.includes("RECO") ? 0 : leads,
    };
  });

  return {
    version: 1,
    generatedAt: t.toISOString(),
    arts: [
      { id: "a1", title: "Sorriso novo em 30 dias", format: "Feed", channel: "Instagram", tag: "TRATAMENTO", c: ["#FF2B00", "#FF8A3D"] },
      { id: "a2", title: "Agende sua avaliação gratuita", format: "Reels", channel: "Instagram", tag: "OFERTA", c: ["#6941C6", "#B692F6"] },
      { id: "a3", title: "5 sinais de que é hora de cuidar da saúde", format: "Carrossel", channel: "Instagram e Facebook", tag: "DICAS", c: ["#155EEF", "#53B1FD"] },
    ].map((a, i) => ({
      id: a.id,
      title: a.title,
      format: a.format,
      channel: a.channel,
      caption: `${a.title}! ✨\n\nNossa equipe preparou condições especiais para este mês. Chame no WhatsApp e garanta seu horário.\n\n#Americana #Saude #Demonstracao`,
      image: artImage(a.title, a.c[0]!, a.c[1]!, a.tag),
      status: "pending" as const,
      publishAt: day(t, 3 + i * 2),
    })),
    posts: [
      { id: "p1", title: "Conheça nossa equipe", channel: "Instagram", format: "Feed", date: day(t, -9), done: true, c: ["#039855", "#6CE9A6"], tag: "EQUIPE" },
      { id: "p2", title: "Antes e depois: resultados reais", channel: "Instagram e Facebook", format: "Reels", date: day(t, -4), done: true, c: ["#DD2590", "#F670C7"], tag: "RESULTADOS" },
      { id: "p3", title: "Horários extras neste sábado", channel: "Instagram", format: "Story", date: day(t, 2), done: false, c: ["#DC6803", "#FDB022"], tag: "AVISO" },
    ].map((p) => ({ id: p.id, title: p.title, channel: p.channel, format: p.format, date: p.date, done: p.done, caption: `${p.title}. Conte com a gente! 💛`, image: artImage(p.title, p.c[0]!, p.c[1]!, p.tag) })),
    requests: [
      {
        id: "r1",
        title: "Trocar a foto de capa do Facebook",
        description: "Queremos usar a foto nova da fachada, com o horário de funcionamento.",
        status: "progress",
        createdAt: day(t, -2),
        updates: [
          { at: day(t, -2), author: "Você", text: "Pedido aberto." },
          { at: day(t, -1), author: "Equipe Zenite", text: "Recebemos a foto e estamos ajustando o enquadramento. Mandamos a prévia amanhã." },
        ],
      },
    ],
    graphics: [
      {
        id: "g1",
        title: "Cartão de visita (500 un.)",
        description: "Frente e verso, papel couché 300 g, com acabamento fosco.",
        status: "done",
        createdAt: day(t, -20),
        updates: [
          { at: day(t, -20), author: "Você", text: "Pedido de orçamento." },
          { at: day(t, -18), author: "Equipe Zenite", text: "Orçamento enviado: R$ 189,00. Entrega em 5 dias úteis." },
        ],
      },
    ],
    campaigns,
    invoices: [
      { id: "i1", month: month(-3), amount: 1890, closing: monthDate(-3, 25), due: monthDate(-2, 5), status: "paid", paidAt: monthDate(-2, 4), method: "Pix" },
      { id: "i2", month: month(-2), amount: 1890, closing: monthDate(-2, 25), due: monthDate(-1, 5), status: "paid", paidAt: monthDate(-1, 5), method: "Boleto" },
      { id: "i3", month: month(-1), amount: 1890, closing: monthDate(-1, 25), due: monthDate(0, 5), status: "paid", paidAt: monthDate(0, 3), method: "Cartão de crédito" },
      { id: "i4", month: month(0), amount: 1890, closing: monthDate(0, 25), due: monthDate(1, 5), status: "open" },
    ],
    files: [
      { id: "f1", name: "Identidade visual - manual da marca.pdf", kind: "pdf", size: "4,2 MB", date: day(t, -40) },
      { id: "f2", name: "Fotos da fachada (ensaio).jpg", kind: "image", size: "8,9 MB", date: day(t, -15) },
      { id: "f3", name: "Vídeo institucional - versão final.mp4", kind: "video", size: "86 MB", date: day(t, -6) },
      { id: "f4", name: "Relatório mensal de resultados.pdf", kind: "pdf", size: "1,1 MB", date: day(t, -3) },
    ],
  };
}

/** Pontos do mapa (Americana): centro, raio e bairros excluídos. */
export const DEMO_MAP = {
  center: [-22.7392, -47.3313] as [number, number],
  radiusMeters: 9000,
  excluded: [
    { name: "Jardim São Paulo", center: [-22.7545, -47.3125] as [number, number], radius: 900 },
    { name: "Distrito Industrial", center: [-22.7205, -47.3620] as [number, number], radius: 1300 },
    { name: "Praia Azul", center: [-22.7010, -47.3050] as [number, number], radius: 1000 },
  ],
};
