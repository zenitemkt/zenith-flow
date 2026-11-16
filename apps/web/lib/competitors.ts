import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { META_GRAPH_API_VERSION } from "@/lib/meta-ads";
import { analyzeCompetitor, engagementOf, formatOf } from "@/lib/competitor-analytics";

/**
 * Concorrentes: dados públicos do Instagram pela API oficial ("business discovery"), usando uma
 * conta de Instagram já conectada no sistema. Só funciona para contas comerciais ou de criador.
 * A Meta não entrega alcance nem visualizações de outra conta: engajamento = curtidas + comentários.
 */
const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp";

export const cleanUsername = (raw: string) =>
  raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();

interface DiscoveryMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
  timestamp: string;
}
interface Discovery {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  media?: { data: DiscoveryMedia[]; paging?: { cursors?: { after?: string } } };
}

/** Conta de Instagram usada para consultar: a do próprio cliente, senão qualquer uma ativa da agência. */
async function discoveryAccount(agencyId: string, clientId: string) {
  const connections = await prisma.socialConnection.findMany({ where: { agencyId, platform: "INSTAGRAM", status: "ACTIVE" }, select: { clientId: true, externalId: true, accessTokenEnc: true } });
  const pick = connections.find((c) => c.clientId === clientId) ?? connections[0];
  if (!pick) throw new Error("Conecte um Instagram em algum cliente (Clientes > Redes) para consultar concorrentes.");
  return { igUserId: pick.externalId, token: decryptSecret(pick.accessTokenEnc) };
}

async function fetchDiscovery(igUserId: string, token: string, username: string, after?: string): Promise<Discovery> {
  const media = `media${after ? `.after(${after})` : ""}.limit(50){${MEDIA_FIELDS}}`;
  const fields = `business_discovery.username(${username}){id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,${media}}`;
  const res = await fetch(`${GRAPH}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.business_discovery) {
    const message: string = data?.error?.error_user_msg || data?.error?.message || `Erro ${res.status}`;
    if (/cannot be found|not found|does not exist|Invalid user id/i.test(message)) throw new Error(`@${username} não foi encontrado, ou é conta pessoal ou privada. Só contas comerciais e de criador podem ser analisadas.`);
    if (data?.error?.code === 10 || /permission/i.test(message)) throw new Error("O Instagram conectado ainda não tem a permissão de leitura de outros perfis (instagram_manage_insights). Adicione a permissão no app da Meta e reconecte o Instagram do cliente.");
    throw new Error(`Instagram: ${message}`);
  }
  return data.business_discovery as Discovery;
}

/** Atualiza perfil, posts e a foto do dia. `deep` busca mais histórico (primeira vez). */
export async function syncCompetitor(competitorId: string, deep = false) {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) throw new Error("Concorrente não encontrado.");
  try {
    const { igUserId, token } = await discoveryAccount(competitor.agencyId, competitor.clientId);
    const pages = deep || !competitor.lastSyncAt ? 4 : 1;
    let after: string | undefined;
    let profile: Discovery | null = null;
    const media: DiscoveryMedia[] = [];
    for (let i = 0; i < pages; i++) {
      const page = await fetchDiscovery(igUserId, token, competitor.igUsername, after);
      profile ??= page;
      media.push(...(page.media?.data ?? []));
      after = page.media?.paging?.cursors?.after;
      if (!after || !page.media?.data.length) break;
    }
    if (!profile) throw new Error("Sem resposta do Instagram.");
    for (const m of media) {
      const data = {
        caption: m.caption ?? null,
        mediaType: m.media_type,
        mediaProductType: m.media_product_type ?? null,
        mediaUrl: m.media_url ?? null,
        thumbnailUrl: m.thumbnail_url ?? (m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM" ? m.media_url ?? null : null),
        permalink: m.permalink ?? null,
        likeCount: m.like_count ?? null,
        commentsCount: m.comments_count ?? null,
        timestamp: new Date(m.timestamp),
      };
      await prisma.competitorPost.upsert({ where: { igMediaId: m.id }, create: { competitorId, igMediaId: m.id, ...data }, update: data });
    }
    const day = new Date(new Date().toISOString().slice(0, 10));
    const snapshot = { followers: profile.followers_count ?? null, follows: profile.follows_count ?? null, mediaCount: profile.media_count ?? null };
    await prisma.competitorSnapshot.upsert({ where: { competitorId_day: { competitorId, day } }, create: { competitorId, day, ...snapshot }, update: snapshot });
    await prisma.competitor.update({
      where: { id: competitorId },
      data: {
        displayName: profile.name ?? null,
        biography: profile.biography ?? null,
        website: profile.website ?? null,
        pictureUrl: profile.profile_picture_url ?? null,
        ...snapshot,
        lastSyncAt: new Date(),
        lastError: null,
      },
    });
    return { posts: media.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o Instagram.";
    await prisma.competitor.update({ where: { id: competitorId }, data: { lastError: message.slice(0, 500) } });
    throw new Error(message);
  }
}

export async function syncAllCompetitors(budgetMs = 45_000) {
  const started = Date.now();
  const list = await prisma.competitor.findMany({ orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } }, select: { id: true } });
  let ok = 0;
  let failed = 0;
  for (const c of list) {
    if (Date.now() - started > budgetMs) break;
    await syncCompetitor(c.id).then(
      () => (ok += 1),
      () => (failed += 1),
    );
  }
  return { total: list.length, ok, failed };
}

/** Análise por IA dos melhores posts do período: o que explica o desempenho e o que aproveitar. */
export async function analyzeTopPostsWithAI(competitorId: string, periodDays: number) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Chave da Claude não configurada.");
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId }, include: { client: { select: { name: true } } } });
  if (!competitor) throw new Error("Concorrente não encontrado.");
  const since = new Date(Date.now() - periodDays * 86_400_000);
  const posts = await prisma.competitorPost.findMany({ where: { competitorId, timestamp: { gte: since } } });
  if (posts.length < 3) throw new Error("Poucos posts no período para analisar. Aumente o período.");
  const stats = analyzeCompetitor(posts, competitor.followers, periodDays);
  const top = stats.top.slice(0, 6);
  const weekday = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toLocaleString("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const describe = (p: (typeof top)[number], i: number) =>
    `POST ${i + 1} (${p.format}, ${weekday(p.timestamp)}): ${p.likeCount ?? "curtidas ocultas"} curtidas, ${p.commentsCount ?? 0} comentários, ${p.lift.toFixed(1)}x a média do perfil.\nLegenda: ${(p.caption ?? "(sem legenda)").slice(0, 1200)}`;
  const context = `Perfil analisado: @${competitor.igUsername} (${competitor.followers ?? "?"} seguidores)${competitor.isOwn ? ", que é o PRÓPRIO cliente" : `, concorrente do cliente "${competitor.client.name}"`}.
Período: últimos ${periodDays} dias, ${stats.posts} posts, média de ${Math.round(stats.avgEngagement)} interações por post (curtidas + comentários).
Formatos: ${stats.formatMix.map((f) => `${f.name} ${f.count} posts, média ${Math.round(f.avgEngagement)}`).join("; ")}.
Hashtags mais usadas: ${stats.topHashtags.slice(0, 10).map((h) => `${h.tag} (${h.uses}x)`).join(", ") || "nenhuma"}.

Os ${top.length} posts com mais interações no período:

${top.map(describe).join("\n\n")}`;
  const instructions = `Você é estrategista de redes sociais de uma agência brasileira. Analise os melhores posts acima e explique, em português do Brasil e em texto simples (sem markdown, sem asteriscos, sem travessão), o que explica o bom desempenho.

Estruture assim, com estes títulos em linhas próprias:
O QUE ESSES POSTS TÊM EM COMUM
(3 a 5 pontos curtos: tema, gancho da primeira linha, formato, oferta, tom, chamada para ação, dia e horário)
POST A POST
(uma ou duas frases por post, dizendo o provável motivo do resultado)
O QUE APROVEITAR
(4 a 6 ideias práticas de conteúdo para o cliente testar, cada uma em uma linha, citando formato e gancho)
CUIDADOS
(1 a 3 limites da análise, por exemplo: só vemos curtidas e comentários, não o alcance)

Use fatos dos posts, não elogios genéricos. Se as imagens forem enviadas, considere o visual (texto na arte, rosto, cores). Frases curtas.`;

  const call = async (withImages: boolean) => {
    const content: unknown[] = [];
    if (withImages) {
      top.forEach((p, i) => {
        if (!p.thumbnailUrl) return;
        content.push({ type: "text", text: `Imagem do POST ${i + 1}:` }, { type: "image", source: { type: "url", url: p.thumbnailUrl } });
      });
    }
    content.push({ type: "text", text: `${context}\n\n${instructions}` });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.COMPETITOR_AI_MODEL || "claude-sonnet-5-5", max_tokens: 6000, output_config: { effort: "low" }, messages: [{ role: "user", content }] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Claude ${res.status}: ${JSON.stringify(data?.error ?? data).slice(0, 200)}`);
    return ((data.content ?? []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
  };
  // Link de imagem do Instagram pode expirar: se falhar com imagens, analisa só pelo texto.
  const report = await call(true).catch(() => call(false));
  if (!report) throw new Error("A análise voltou vazia. Tente de novo.");
  await prisma.competitor.update({ where: { id: competitorId }, data: { aiReport: report, aiReportAt: new Date(), aiReportDays: periodDays } });
  return report;
}

export { engagementOf, formatOf };
