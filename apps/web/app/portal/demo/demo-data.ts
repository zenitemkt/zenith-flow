import type { DemoRealArtSet } from "@/lib/portal-demo";

/**
 * Painel de demonstração do portal: tudo fictício, gerado a partir da data de hoje e guardado só
 * no navegador (localStorage). Nada aqui toca o banco do CRM. "Resetar painel" volta a este estado.
 */

/** published = já foi ao ar · scheduled = aprovado e agendado · pending = aguardando aprovação · changes = cliente pediu ajuste. */
export type PostStatus = "published" | "scheduled" | "pending" | "changes";
export type PostKind = "FEED" | "STORIE";
export interface DemoPost {
  id: string;
  title: string;
  kind: PostKind;
  channel: string;
  caption: string;
  image: string;
  status: PostStatus;
  /** Data e hora locais: "AAAA-MM-DDTHH:mm". */
  at: string;
  artNote?: string;
  captionNote?: string;
}
export type RequestStatus = "waiting" | "progress" | "done";
export interface DemoQuote {
  amount: number;
  status: "pending" | "approved" | "declined";
  note: string;
}
export interface DemoRequest {
  id: string;
  ticket: number;
  title: string;
  description: string;
  status: RequestStatus;
  createdAt: string;
  deadline?: string;
  links: string[];
  attachments: { name: string; size: string }[];
  updates: { at: string; author: string; text: string }[];
  /** Só em peças gráficas: cotação da impressão (terceirizada, fora do plano). */
  quote?: DemoQuote;
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
  receipt: string;
  nf: string;
}
export interface DemoFile {
  id: string;
  name: string;
  kind: "image" | "video" | "pdf";
  size: string;
  date: string;
}
export interface DemoState {
  version: 3;
  /** Quais artes reais montaram o estado: se mudarem, o demo é refeito. */
  artSig: string;
  generatedAt: string;
  posts: DemoPost[];
  requests: DemoRequest[];
  graphics: DemoRequest[];
  campaigns: DemoCampaign[];
  invoices: DemoInvoice[];
  files: DemoFile[];
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Data local "AAAA-MM-DD" (sem passar por UTC, que muda o dia à noite). */
export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localDateTime = (d: Date) => `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const day = (base: Date, offset: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return localDate(d);
};

/** Arte fictícia (SVG) com cara de post: degradê, título e marca. Story sai na vertical (9:16). */
export function artImage(title: string, c1: string, c2: string, tag: string, vertical = false): string {
  const h = vertical ? 1920 : 1350;
  const lines: string[] = [];
  for (const word of title.split(" ")) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= 16) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const top = vertical ? 760 : 480;
  const titleSvg = lines.map((line, i) => `<text x="90" y="${top + i * 110}" font-family="Arial, sans-serif" font-size="96" font-weight="800" fill="#fff">${line}</text>`).join("");
  const btnY = h - 200;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1080" height="${h}" fill="url(#g)"/><circle cx="880" cy="260" r="260" fill="#fff" fill-opacity=".12"/><circle cx="160" cy="${h - 170}" r="200" fill="#fff" fill-opacity=".08"/><text x="90" y="200" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#fff" fill-opacity=".85" letter-spacing="6">${tag}</text>${titleSvg}<rect x="90" y="${btnY}" width="320" height="90" rx="45" fill="#fff"/><text x="250" y="${btnY + 58}" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="${c1}">${vertical ? "Arraste" : "Saiba mais"}</text><text x="990" y="${h - 60}" text-anchor="end" font-family="Arial, sans-serif" font-size="34" fill="#fff" fill-opacity=".8">Demonstração</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PALETTE: [string, string][] = [
  ["#FF2B00", "#FF8A3D"],
  ["#6941C6", "#B692F6"],
  ["#155EEF", "#53B1FD"],
  ["#039855", "#6CE9A6"],
  ["#DD2590", "#F670C7"],
  ["#DC6803", "#FDB022"],
  ["#0E9384", "#5FE9D0"],
  ["#C01048", "#FD6F8E"],
];
const FEED_TOPICS: [string, string][] = [
  ["Sorriso novo em 30 dias", "TRATAMENTO"],
  ["5 sinais de que é hora de cuidar da saúde", "DICAS"],
  ["Conheça nossa equipe", "EQUIPE"],
  ["Antes e depois: resultados reais", "RESULTADOS"],
  ["Agende sua avaliação gratuita", "OFERTA"],
  ["Mitos e verdades do tratamento", "EDUCATIVO"],
  ["O que nossos clientes dizem", "DEPOIMENTO"],
  ["Novidade na clínica", "NOVIDADE"],
  ["Dica da semana", "DICAS"],
  ["Pergunta do seguidor", "VOCÊ PERGUNTOU"],
  ["Bastidores do atendimento", "BASTIDORES"],
  ["Condição especial do mês", "PROMOÇÃO"],
];
const STORY_TOPICS: [string, string][] = [
  ["Horários extras neste sábado", "AVISO"],
  ["Enquete: qual sua maior dúvida?", "ENQUETE"],
  ["Bom dia com a equipe", "ROTINA"],
  ["Últimas vagas da semana", "AGENDA"],
  ["Caixinha de perguntas", "INTERAÇÃO"],
  ["Faltam 3 dias!", "CONTAGEM"],
  ["Bastidores de hoje", "BASTIDORES"],
  ["Arraste e agende pelo WhatsApp", "AGENDA"],
];
const FEED_TIMES = ["10:00", "12:30", "19:00", "11:00"];
const STORY_TIMES = ["08:30", "17:00", "18:30", "20:00"];

/** Planejamento de três meses (anterior, atual e próximo): 2 ou 3 dias de post por semana, às vezes FEED e STORIE no mesmo dia. */
function buildPosts(now: Date, art?: DemoRealArtSet): DemoPost[] {
  const feedArt = [...(art?.feed ?? [])].reverse();
  const storyArt = [...(art?.story ?? [])].reverse();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const nowKey = localDateTime(now);
  const slots: { date: string; kind: PostKind; time: string }[] = [];
  let feedN = 0;
  let storyN = 0;
  for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
    const week = Math.floor(i / 7);
    const dow = d.getDay();
    const date = localDate(d);
    const even = week % 2 === 0;
    const postDays = even ? [1, 3, 5] : [2, 4];
    if (!postDays.includes(dow)) continue;
    // Dia "cheio": FEED de manhã e STORIE à tarde.
    const both = (even && dow === 3) || (!even && dow === 4);
    if (both) {
      slots.push({ date, kind: "FEED", time: FEED_TIMES[feedN++ % FEED_TIMES.length]! });
      slots.push({ date, kind: "STORIE", time: STORY_TIMES[storyN++ % STORY_TIMES.length]! });
    } else if ((i + week) % 3 === 0) {
      slots.push({ date, kind: "STORIE", time: STORY_TIMES[storyN++ % STORY_TIMES.length]! });
    } else {
      slots.push({ date, kind: "FEED", time: FEED_TIMES[feedN++ % FEED_TIMES.length]! });
    }
  }
  let future = 0;
  let fi = 0;
  let si = 0;
  return slots.map((slot, idx) => {
    const at = `${slot.date}T${slot.time}`;
    const [topic, tag] = slot.kind === "FEED" ? FEED_TOPICS[fi++ % FEED_TOPICS.length]! : STORY_TOPICS[si++ % STORY_TOPICS.length]!;
    const [c1, c2] = PALETTE[idx % PALETTE.length]!;
    let status: PostStatus = "published";
    if (at > nowKey) {
      // Os dois próximos já estão aprovados; daí em diante metade aguarda aprovação.
      status = future < 2 || future % 2 === 1 ? "scheduled" : "pending";
      future++;
    }
    const fallbackCaption =
      slot.kind === "FEED"
        ? `${topic}! ✨\n\nNossa equipe preparou condições especiais para este mês. Chame no WhatsApp e garanta seu horário.\n\n#Americana #Saude #Demonstracao`
        : `${topic} 👉 Responda este story ou toque no link para falar com a gente.`;
    // Arte real da Zenite (da mais antiga para a mais nova, repetindo se faltar); sem ela, a arte de exemplo.
    const pool = slot.kind === "FEED" ? feedArt : storyArt;
    const real = pool.length ? pool[(slot.kind === "FEED" ? fi - 1 : si - 1) % pool.length] : undefined;
    // Arte real sem legenda: texto neutro (os temas de exemplo não combinam com a arte de verdade).
    const neutral = slot.kind === "FEED" ? ["Conteúdo da semana", "✨ Conteúdo preparado pela equipe para o seu perfil.\n\nChame no WhatsApp e saiba mais."] : ["Story do dia", "👉 Responda este story ou toque no link para falar com a gente."];
    const caption = real ? real.caption || neutral[1]! : fallbackCaption;
    const name = real ? titleFromCaption(real.caption) || neutral[0]! : topic;
    return {
      id: `p${idx + 1}`,
      title: `[${slot.kind}] ${name}`,
      kind: slot.kind,
      channel: slot.kind === "FEED" ? "Instagram e Facebook" : "Instagram",
      caption,
      image: real?.src ?? artImage(topic, c1, c2, tag, slot.kind === "STORIE"),
      status,
      at,
    };
  });
}

/** Título curto a partir da primeira linha da legenda (sem hashtags), cortado numa palavra. */
function titleFromCaption(caption: string): string {
  const line = caption
    .split("\n")
    .map((l) => l.replace(/#[\p{L}\p{N}_]+/gu, "").trim())
    .find((l) => l.length > 2);
  if (!line) return "";
  if (line.length <= 44) return line;
  const cut = line.slice(0, 44);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : 44).trim()}…`;
}

type RequestSeed = Omit<DemoRequest, "id" | "ticket" | "createdAt" | "updates" | "links" | "attachments" | "deadline"> & {
  ago: number;
  deadlineIn?: number;
  links?: string[];
  attachments?: { name: string; size: string }[];
  reply?: string;
};

function buildRequests(now: Date): { requests: DemoRequest[]; graphics: DemoRequest[] } {
  const digital: RequestSeed[] = [
    { title: "Post sobre o feriado de Carnaval", description: "Avisar que a clínica fecha na segunda e na terça.", status: "done", ago: 270, reply: "Post publicado no feed e nos stories." },
    { title: "Atualizar a bio do Instagram", description: "Colocar o novo telefone e o link do WhatsApp.", status: "done", ago: 240, links: ["https://instagram.com"], reply: "Bio atualizada." },
    { title: "Destaques novos no perfil", description: "Criar capas para os destaques: Tratamentos, Equipe, Depoimentos e Localização.", status: "done", ago: 210, reply: "Capas criadas e destaques organizados." },
    { title: "Vídeo de boas-vindas da Dra. Ana", description: "Editar o vídeo gravado no celular, com legenda e trilha.", status: "done", ago: 185, attachments: [{ name: "video-dra-ana.mp4", size: "142 MB" }], reply: "Vídeo editado e aprovado." },
    { title: "Campanha do Dia das Mães", description: "Sequência de 3 posts e 5 stories com o cupom MAES10.", status: "done", ago: 160, deadlineIn: -150, reply: "Campanha entregue e no ar." },
    { title: "Trocar foto de perfil", description: "Usar a logo nova em fundo laranja.", status: "done", ago: 140, attachments: [{ name: "logo-nova.png", size: "320 KB" }], reply: "Foto trocada no Instagram e no Facebook." },
    { title: "Responder avaliações no Google", description: "Temos 8 avaliações sem resposta.", status: "done", ago: 115, links: ["https://business.google.com"], reply: "Todas respondidas." },
    { title: "Carrossel: cuidados pós-tratamento", description: "Conteúdo educativo com 6 telas, linguagem simples.", status: "done", ago: 90, links: ["https://www.pinterest.com/search/pins/?q=carrossel%20saude"], reply: "Carrossel publicado." },
    { title: "Fotos novas da recepção", description: "Tratar as fotos que enviamos e usar nos próximos posts.", status: "done", ago: 64, attachments: [{ name: "recepcao-01.jpg", size: "4,1 MB" }, { name: "recepcao-02.jpg", size: "3,8 MB" }], reply: "Fotos tratadas e na pasta Arquivos." },
    { title: "Reels com depoimento de paciente", description: "Cortar o depoimento da Márcia em um Reels de até 40 segundos.", status: "done", ago: 41, deadlineIn: -33, reply: "Reels publicado." },
    { title: "Banner do site para a Black Friday", description: "Banner principal e versão para celular.", status: "done", ago: 22, deadlineIn: -14, links: ["https://hubzenite.com.br"], reply: "Banners entregues." },
    { title: "Trocar a foto de capa do Facebook", description: "Queremos usar a foto nova da fachada, com o horário de funcionamento.", status: "progress", ago: 6, deadlineIn: 4, attachments: [{ name: "fachada-nova.jpg", size: "5,6 MB" }], reply: "Recebemos a foto e estamos ajustando o enquadramento." },
    { title: "Série de posts sobre prevenção", description: "4 posts para o próximo mês, um por semana.", status: "progress", ago: 4, deadlineIn: 12, links: ["https://www.instagram.com/explore/tags/prevencao/"], reply: "Roteiro pronto, artes em produção." },
    { title: "Story de aniversário da clínica", description: "A clínica faz 10 anos dia 28. Algo comemorativo, com sorteio.", status: "progress", ago: 3, deadlineIn: 10, reply: "Ideias enviadas por WhatsApp, aguardando o regulamento do sorteio." },
    { title: "Vídeo com as perguntas mais frequentes", description: "Gravar respostas curtas para as 5 dúvidas mais comuns no direct.", status: "waiting", ago: 1, deadlineIn: 15, links: ["https://www.youtube.com/shorts"] },
  ];
  const graphic: RequestSeed[] = [
    { title: "Cartão de visita (500 un.)", description: "Frente e verso, couché 300 g, acabamento fosco.", status: "done", ago: 200, quote: { amount: 189, status: "approved", note: "Entrega em 5 dias úteis." }, reply: "Cartões entregues na recepção." },
    { title: "Banner para a fachada (3 x 1 m)", description: "Lona com ilhós, com o horário de atendimento.", status: "done", ago: 120, quote: { amount: 420, status: "approved", note: "Lona 440 g com instalação inclusa." }, reply: "Banner instalado." },
    { title: "Flyer da campanha de inverno (1.000 un.)", description: "A5, frente e verso, para distribuir no centro.", status: "progress", ago: 9, deadlineIn: 6, quote: { amount: 265, status: "approved", note: "Couché 115 g, entrega em 4 dias úteis." }, reply: "Arte aprovada, na gráfica." },
    { title: "Adesivo para a porta de vidro", description: "Logo e telefone, recorte em vinil branco.", status: "waiting", ago: 2, deadlineIn: 14, attachments: [{ name: "foto-porta.jpg", size: "2,2 MB" }], quote: { amount: 310, status: "pending", note: "Vinil recortado com aplicação no local. Prazo de 6 dias úteis após a aprovação." } },
    { title: "Pasta institucional (200 un.)", description: "Com bolso interno e espaço para cartão.", status: "waiting", ago: 1, deadlineIn: 20 },
  ];
  const all = [...digital.map((r) => ({ r, kind: "requests" as const })), ...graphic.map((r) => ({ r, kind: "graphics" as const }))].sort((a, b) => b.r.ago - a.r.ago);
  const requests: DemoRequest[] = [];
  const graphics: DemoRequest[] = [];
  all.forEach(({ r, kind }, i) => {
    const createdAt = day(now, -r.ago);
    const updates = [{ at: createdAt, author: "Você", text: "Pedido aberto." }];
    if (r.quote) updates.push({ at: day(now, -r.ago + 1), author: "Equipe Zenite", text: `Cotação enviada: ${r.quote.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. ${r.quote.note}` });
    if (r.reply) updates.push({ at: day(now, -Math.max(0, r.ago - 2)), author: "Equipe Zenite", text: r.reply });
    const item: DemoRequest = {
      id: `${kind === "requests" ? "r" : "g"}${i + 1}`,
      ticket: 15003 + i,
      title: r.title,
      description: r.description,
      status: r.status,
      createdAt,
      deadline: r.deadlineIn !== undefined ? day(now, r.deadlineIn) : undefined,
      links: r.links ?? [],
      attachments: r.attachments ?? [],
      updates,
      quote: r.quote,
    };
    (kind === "requests" ? requests : graphics).push(item);
  });
  // Mais recentes primeiro.
  requests.reverse();
  graphics.reverse();
  return { requests, graphics };
}

export function demoArtSignature(art?: DemoRealArtSet): string {
  return art ? `${art.feed.length}:${art.story.length}:${art.feed[0]?.src ?? ""}:${art.story[0]?.src ?? ""}` : "";
}

export function buildDemoState(now = new Date(), art?: DemoRealArtSet): DemoState {
  const t = now;
  const month = (offset: number) => {
    const d = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };
  const monthDate = (offset: number, dayOfMonth: number) => localDate(new Date(t.getFullYear(), t.getMonth() + offset, dayOfMonth));

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
    "[MSG02] WhatsApp Direto | Americana e Nova Odessa",
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

  const year = t.getFullYear();
  const invoice = (n: number, offset: number, paid: { day: number; method: string } | null): DemoInvoice => ({
    id: `i${n}`,
    month: month(offset),
    amount: 1890,
    closing: monthDate(offset, 25),
    due: monthDate(offset + 1, 5),
    status: paid ? "paid" : "open",
    ...(paid ? { paidAt: monthDate(offset + 1, paid.day), method: paid.method } : {}),
    receipt: `REC-${year}-${pad(40 + n)}`,
    nf: `${String(1200 + n * 17).padStart(9, "0")}`,
  });

  return {
    version: 3,
    artSig: demoArtSignature(art),
    generatedAt: t.toISOString(),
    posts: buildPosts(t, art),
    ...buildRequests(t),
    campaigns,
    invoices: [invoice(1, -3, { day: 4, method: "Pix" }), invoice(2, -2, { day: 5, method: "Boleto" }), invoice(3, -1, { day: 3, method: "Cartão de crédito" }), invoice(4, 0, null)],
    files: [
      { id: "f1", name: "Identidade visual - manual da marca.pdf", kind: "pdf", size: "4,2 MB", date: day(t, -40) },
      { id: "f2", name: "Fotos da fachada (ensaio).jpg", kind: "image", size: "8,9 MB", date: day(t, -15) },
      { id: "f3", name: "Vídeo institucional - versão final.mp4", kind: "video", size: "86 MB", date: day(t, -6) },
      { id: "f4", name: "Relatório mensal de resultados.pdf", kind: "pdf", size: "1,1 MB", date: day(t, -3) },
    ],
  };
}

/** Resumo de tráfego por período (números fictícios, coerentes entre si). */
export type TrafficPeriod = "month" | "week" | "today";
export const DEMO_TRAFFIC: Record<TrafficPeriod, { label: string; compare: string; spend: number; reach: number; impressions: number; clicks: number; leads: number; frequency: number; delta: { reach: number; leads: number; cpl: number } }> = {
  month: { label: "Mês passado", compare: "vs. mês anterior", spend: 2980, reach: 41250, impressions: 98700, clicks: 3120, leads: 128, frequency: 2.4, delta: { reach: 18, leads: 14, cpl: -9 } },
  week: { label: "7 dias", compare: "vs. 7 dias anteriores", spend: 720, reach: 12840, impressions: 26900, clicks: 864, leads: 34, frequency: 2.1, delta: { reach: 6, leads: 11, cpl: -4 } },
  today: { label: "Hoje", compare: "vs. ontem", spend: 104, reach: 2310, impressions: 4180, clicks: 131, leads: 6, frequency: 1.8, delta: { reach: 3, leads: 20, cpl: -7 } },
};

/** Leads por mês nos últimos 12 meses (o último é o mês passado), em crescimento. */
export function leadsByMonth(now = new Date()) {
  const values = [38, 44, 41, 52, 58, 63, 71, 69, 84, 97, 112, 128];
  return values.map((value, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
    return { label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), value };
  });
}

type LatLng = [number, number];
/** Mapa: três raios de anúncio (Americana, Santa Bárbara d'Oeste e Nova Odessa) e bairros excluídos dentro deles. */
export const DEMO_MAP = {
  areas: [
    { name: "Americana", center: [-22.7392, -47.3313] as LatLng, radius: 4000 },
    { name: "Santa Bárbara d'Oeste", center: [-22.7536, -47.4142] as LatLng, radius: 2000 },
    { name: "Nova Odessa", center: [-22.7797, -47.2961] as LatLng, radius: 2800 },
  ],
  excluded: [
    { name: "Jardim São Paulo", center: [-22.753, -47.319] as LatLng, radius: 450 },
    { name: "Distrito Industrial", center: [-22.724, -47.349] as LatLng, radius: 600 },
    { name: "Jardim Europa", center: [-22.76, -47.406] as LatLng, radius: 350 },
  ],
};
