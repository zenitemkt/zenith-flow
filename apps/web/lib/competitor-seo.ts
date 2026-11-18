import { prisma } from "@zenite-mkt/db";

export interface SeoCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

/** Busca com tempo limite curto; usado para a página, o robots.txt e o sitemap. */
async function safeFetch(url: string, init?: RequestInit) {
  try {
    return await fetch(url, { ...init, redirect: "follow", signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "ZeniteFlowBot/1.0 (+https://hubzenite.com.br)" } });
  } catch {
    return null;
  }
}

const tag = (html: string, name: string) => {
  const match = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i"));
  return match ? match[0].match(/content=["']([^"']*)["']/i)?.[1]?.trim() ?? "" : null;
};

/** Auditoria de SEO on-page do site, sem biblioteca externa (regex simples sobre o HTML). */
export async function fetchSeoAudit(rawUrl: string): Promise<{ score: number; checks: SeoCheck[] }> {
  const url = new URL(rawUrl);
  const checks: SeoCheck[] = [];
  checks.push({ id: "https", label: "Site usa HTTPS", ok: url.protocol === "https:", detail: url.protocol === "https:" ? "Conexão segura." : "O site ainda responde em http://." });

  const pageRes = await safeFetch(url.toString());
  const html = pageRes?.ok ? await pageRes.text().catch(() => "") : "";
  if (!pageRes?.ok) {
    checks.push({ id: "page", label: "Página inicial responde", ok: false, detail: `Não consegui abrir a página (${pageRes?.status ?? "sem resposta"}).` });
    return { score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100), checks };
  }

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  checks.push({ id: "title", label: "Título da página (title)", ok: title.length >= 10 && title.length <= 70, detail: title ? `"${title}" (${title.length} caracteres)` : "Sem tag <title>." });

  const description = tag(html, "description") ?? "";
  checks.push({ id: "description", label: "Meta description", ok: description.length >= 50 && description.length <= 160, detail: description ? `${description.length} caracteres` : "Sem meta description." });

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  checks.push({ id: "h1", label: "Um único H1 na página", ok: h1Count === 1, detail: h1Count === 0 ? "Nenhum H1 encontrado." : h1Count === 1 ? "1 H1 na página." : `${h1Count} tags H1 (o ideal é 1).` });

  checks.push({ id: "viewport", label: "Meta viewport (mobile)", ok: /<meta[^>]+name=["']viewport["']/i.test(html), detail: /<meta[^>]+name=["']viewport["']/i.test(html) ? "Presente." : "Ausente: pode prejudicar no celular." });

  checks.push({ id: "canonical", label: "Link canonical", ok: /<link[^>]+rel=["']canonical["']/i.test(html), detail: /<link[^>]+rel=["']canonical["']/i.test(html) ? "Presente." : "Ausente." });

  checks.push({ id: "structured-data", label: "Dados estruturados (schema.org)", ok: /application\/ld\+json/i.test(html), detail: /application\/ld\+json/i.test(html) ? "Encontrado JSON-LD." : "Nenhum JSON-LD encontrado." });

  const robotsRes = await safeFetch(new URL("/robots.txt", url).toString());
  checks.push({ id: "robots", label: "robots.txt acessível", ok: Boolean(robotsRes?.ok), detail: robotsRes?.ok ? "Encontrado." : "Não encontrado em /robots.txt." });

  const sitemapUrl = robotsRes?.ok ? (await robotsRes.text().catch(() => "")).match(/sitemap:\s*(\S+)/i)?.[1] : null;
  const sitemapRes = await safeFetch(sitemapUrl ?? new URL("/sitemap.xml", url).toString());
  checks.push({ id: "sitemap", label: "Sitemap acessível", ok: Boolean(sitemapRes?.ok), detail: sitemapRes?.ok ? `Encontrado${sitemapUrl ? "" : " em /sitemap.xml"}.` : "Não encontrado." });

  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, checks };
}

export async function syncCompetitorSeo(competitorId: string, website: string) {
  try {
    const { score, checks } = await fetchSeoAudit(website);
    await prisma.competitor.update({ where: { id: competitorId }, data: { seoChecks: checks as never, seoCheckedAt: new Date(), seoError: null } });
    return { score, checks };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao analisar o SEO do site.";
    await prisma.competitor.update({ where: { id: competitorId }, data: { seoError: message.slice(0, 500) } });
    throw new Error(message);
  }
}
