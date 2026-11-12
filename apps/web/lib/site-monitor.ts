import { prisma } from "@zenite-mkt/db";
import { raiseSystemAlert, resolveSystemAlert } from "@/lib/system-alerts";

/**
 * Monitor do site (roda pelo cron da Vercel, 2x por dia). Checa todas as páginas do sitemap
 * mais os links internos da home e do blog (pega link relativo quebrado, como o erro de
 * 12/11/2026 em que /blog sem barra mandava os artigos para 404). Uma requisição por página,
 * com uma nova tentativa antes de considerar falha. Também confere se o script de traqueamento
 * carrega e se chegaram eventos nas últimas 24 h.
 */
const ASSET = /\.(css|js|mjs|png|jpe?g|webp|gif|svg|ico|pdf|xml|txt|json|woff2?|mp4|webm)(\?|$)/i;
const TIMEOUT_MS = 15_000;

export function siteMonitorTarget(): { agencyId: string | undefined; siteUrl: string } {
  return {
    agencyId: process.env.SITE_MONITOR_AGENCY_ID ?? process.env.SITE_LEADS_AGENCY_ID,
    siteUrl: (process.env.SITE_MONITOR_URL ?? "https://hubzenite.com.br").replace(/\/+$/, ""),
  };
}

async function get(url: string): Promise<{ status: number; body: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": "ZeniteFlow-Monitor/1.0" }, cache: "no-store" });
    const type = response.headers.get("content-type") ?? "";
    const body = /html|xml|javascript|text/.test(type) ? await response.text() : "";
    return { status: response.status, body, finalUrl: response.url || url };
  } catch {
    return { status: 0, body: "", finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

/** Status final com uma segunda tentativa (evita alerta por instabilidade de um segundo). */
async function check(url: string): Promise<number> {
  const first = await get(url);
  if (first.status >= 200 && first.status < 400) return first.status;
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return (await get(url)).status;
}

function internalLinks(html: string, pageUrl: string, origin: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*"([^"#]+)"/gi)) {
    const raw = match[1]!.trim();
    if (/^(mailto:|tel:|javascript:|data:|whatsapp:)/i.test(raw)) continue;
    let resolved: URL;
    try {
      resolved = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (resolved.origin !== origin || ASSET.test(resolved.pathname)) continue;
    resolved.hash = "";
    resolved.search = "";
    out.add(resolved.toString());
  }
  return Array.from(out);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]!);
      }
    }),
  );
  return results;
}

export interface SiteMonitorResult {
  checked: number;
  broken: { url: string; status: number; foundOn: string }[];
  trackingScriptOk: boolean;
  eventsLast24h: number;
}

/** Varre o site sem tocar no banco (dá para rodar localmente). */
export async function scanSite(siteUrl: string) {
  const origin = new URL(siteUrl).origin;

  // 1. Home e blog (com as páginas de origem dos links, para dizer onde o link quebrado está).
  const foundOn = new Map<string, string>();
  const home = await get(`${siteUrl}/`);
  const blog = await get(`${siteUrl}/blog/`);
  // /blog sem barra: os links relativos são resolvidos a partir do endereço final que o navegador vê.
  // Foi assim que quebrou em 12/11/2026 (sem redirecionamento, "./artigo/" virava "/artigo/").
  const blogBare = await get(`${siteUrl}/blog`);
  const blogNoSlash = blogBare.status;
  for (const [page, html] of [[home.finalUrl, home.body], [blog.finalUrl, blog.body], [blogBare.finalUrl, blogBare.body]] as const) {
    for (const link of internalLinks(html, page, origin)) if (!foundOn.has(link)) foundOn.set(link, page);
  }
  // 2. Sitemap.
  const sitemap = await get(`${siteUrl}/sitemap.xml`);
  for (const match of sitemap.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    const url = match[1]!;
    if (url.startsWith(origin) && !foundOn.has(url)) foundOn.set(url, "sitemap.xml");
  }

  const urls = Array.from(foundOn.keys());
  const statuses = await mapLimit(urls, 6, check);
  const broken = urls
    .map((url, i) => ({ url, status: statuses[i]!, foundOn: foundOn.get(url)! }))
    .filter((r) => r.status === 0 || r.status >= 400);
  const script = await get(`${siteUrl}/tracking.js`);
  return { origin, urls, broken, home, sitemap, blogNoSlash, script };
}

export async function runSiteMonitor(): Promise<SiteMonitorResult> {
  const { agencyId, siteUrl } = siteMonitorTarget();
  if (!agencyId) throw new Error("SITE_LEADS_AGENCY_ID (ou SITE_MONITOR_AGENCY_ID) não configurado.");
  const { origin, urls, broken, home, sitemap, blogNoSlash, script } = await scanSite(siteUrl);

  // 3. Alertas do site.
  const homeOk = home.status >= 200 && home.status < 400;
  if (!homeOk) {
    await raiseSystemAlert({ agencyId, key: "site:home", category: "SITE", severity: "CRITICAL", title: "Site fora do ar", detail: `${siteUrl}/ respondeu ${home.status || "sem resposta"}.`, href: siteUrl });
  } else await resolveSystemAlert(agencyId, "site:home");

  if (sitemap.status !== 200) {
    await raiseSystemAlert({ agencyId, key: "site:sitemap", category: "SITE", severity: "WARNING", title: "Sitemap indisponível", detail: `${siteUrl}/sitemap.xml respondeu ${sitemap.status || "sem resposta"}. O Google usa esse arquivo para achar as páginas.`, href: `${siteUrl}/sitemap.xml` });
  } else await resolveSystemAlert(agencyId, "site:sitemap");

  if (blogNoSlash === 0 || blogNoSlash >= 400) {
    await raiseSystemAlert({ agencyId, key: "site:blog-no-slash", category: "SITE", severity: "WARNING", title: "/blog sem barra final não abre", detail: `${siteUrl}/blog respondeu ${blogNoSlash || "sem resposta"}.`, href: `${siteUrl}/blog` });
  } else await resolveSystemAlert(agencyId, "site:blog-no-slash");

  if (broken.length) {
    const blogBroken = broken.some((b) => b.url.includes("/blog/") || b.foundOn.includes("/blog/"));
    const list = broken.slice(0, 20).map((b) => `• ${b.url.replace(origin, "")} (${b.status || "sem resposta"}${b.foundOn === "sitemap.xml" ? ", no sitemap" : `, link em ${b.foundOn.replace(origin, "") || "/"}`})`).join("\n");
    await raiseSystemAlert({
      agencyId,
      key: "site:pages",
      category: blogBroken ? "BLOG" : "SITE",
      severity: "CRITICAL",
      title: `${broken.length} página(s) do site fora do ar`,
      detail: `${list}${broken.length > 20 ? `\n… e mais ${broken.length - 20}.` : ""}`,
      href: broken[0]!.url,
    });
  } else await resolveSystemAlert(agencyId, "site:pages");

  // 4. Traqueamento: script carregando e eventos chegando.
  const trackingScriptOk = script.status === 200 && script.body.includes("ZFTrack");
  if (!trackingScriptOk) {
    await raiseSystemAlert({ agencyId, key: "tracking:script", category: "TRACKING", severity: "CRITICAL", title: "Script de traqueamento não carrega", detail: `${siteUrl}/tracking.js respondeu ${script.status || "sem resposta"}${script.status === 200 ? " mas sem o código ZFTrack" : ""}. Visitas e leads do site param de ser registrados.`, href: "/traqueamento" });
  } else await resolveSystemAlert(agencyId, "tracking:script");

  const eventsLast24h = await prisma.trackingEvent.count({ where: { agencyId, occurredAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (eventsLast24h === 0) {
    await raiseSystemAlert({ agencyId, key: "tracking:no-events", category: "TRACKING", severity: "WARNING", title: "Nenhum evento do site nas últimas 24 h", detail: "O coletor não recebeu nenhuma visita do site em 24 horas. Confira se o script está instalado e se o coletor está no ar.", href: "/traqueamento" });
  } else await resolveSystemAlert(agencyId, "tracking:no-events");

  return { checked: urls.length + 4, broken, trackingScriptOk, eventsLast24h };
}
