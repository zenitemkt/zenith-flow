import { prisma } from "@zenite-mkt/db";
import type { SystemAlertCategory, SystemAlertSeverity } from "@prisma/client";

/**
 * Central de alertas de sistema. `raiseSystemAlert` abre (ou soma uma ocorrência em) um alerta
 * pela chave; `resolveSystemAlert` fecha quando a checagem volta a passar. As duas nunca lançam
 * erro: um alerta que falhou ao gravar não pode derrubar a rotina que detectou o problema.
 */
/** Tipos de alerta que a agência pode ligar/desligar. Cada tipo cobre uma ou mais chaves (por prefixo). */
export const SYSTEM_ALERT_TYPES = [
  { id: "commercial", category: "COMMERCIAL", label: "Pendências comerciais", description: "Lead sem resposta, lead quente, formulário abandonado e retornos.", prefixes: [] as string[] },
  { id: "site-down", category: "SITE", label: "Páginas fora do ar", description: "Home, páginas do sitemap e links internos quebrados (checagem às 7h e às 10h).", prefixes: ["site:home", "site:pages", "site:blog-no-slash"] },
  { id: "site-sitemap", category: "SITE", label: "Sitemap indisponível", description: "O arquivo que o Google usa para achar as páginas não abre.", prefixes: ["site:sitemap"] },
  { id: "tracking-script", category: "TRACKING", label: "Script de traqueamento", description: "O tracking.js do site não carrega.", prefixes: ["tracking:script"] },
  { id: "tracking-events", category: "TRACKING", label: "Site sem eventos em 24 h", description: "Nenhuma visita chegou ao coletor em um dia inteiro.", prefixes: ["tracking:no-events"] },
  { id: "meta-leads", category: "TRACKING", label: "Lead da Meta não entrou", description: "Formulário nativo da Meta que falhou ao virar lead no CRM.", prefixes: ["meta-leads:"] },
  { id: "blog-publish", category: "BLOG", label: "Artigo não publicado", description: "Falha ao publicar um artigo do blog no site.", prefixes: ["blog:publish:"] },
  { id: "social-post", category: "SOCIAL", label: "Publicação nas redes falhou", description: "Post agendado que não saiu no Instagram ou no Facebook.", prefixes: ["social:post:"] },
  { id: "instagram-chat", category: "SOCIAL", label: "Mini-chat do Instagram", description: "Resposta automática de gatilho, comentário ou direct que falhou.", prefixes: ["instagram:send:"] },
  { id: "assistant", category: "AUTOMATION", label: "Assistente virtual (Milena)", description: "Falhou duas vezes com um lead e passou a conversa para a equipe.", prefixes: ["assistant:"] },
  { id: "social-connection", category: "INTEGRATION", label: "Conexão de rede social expirou", description: "Acesso a um perfil expirou ou foi removido.", prefixes: ["social:connection:"] },
] as const;
export type SystemAlertTypeId = (typeof SYSTEM_ALERT_TYPES)[number]["id"];

export function alertTypeOfKey(key: string): SystemAlertTypeId | null {
  return SYSTEM_ALERT_TYPES.find((t) => t.prefixes.some((p) => key.startsWith(p)))?.id ?? null;
}

export async function getDisabledAlertTypes(agencyId: string): Promise<Set<string>> {
  try {
    const settings = await prisma.systemAlertSettings.findUnique({ where: { agencyId } });
    return new Set(settings?.disabledTypes ?? []);
  } catch {
    return new Set();
  }
}

export interface RaiseSystemAlertInput {
  agencyId: string;
  key: string;
  category: SystemAlertCategory;
  severity: SystemAlertSeverity;
  title: string;
  detail: string;
  href?: string | null;
}

export async function raiseSystemAlert(input: RaiseSystemAlertInput): Promise<void> {
  try {
    const type = alertTypeOfKey(input.key);
    if (type && (await getDisabledAlertTypes(input.agencyId)).has(type)) return; // tipo desligado no painel
    const now = new Date();
    const existing = await prisma.systemAlert.findUnique({ where: { agencyId_key: { agencyId: input.agencyId, key: input.key } } });
    const data = { category: input.category, severity: input.severity, title: input.title.slice(0, 200), detail: input.detail.slice(0, 2000), href: input.href ?? null, lastSeenAt: now };
    if (!existing) {
      await prisma.systemAlert.create({ data: { agencyId: input.agencyId, key: input.key, ...data } });
      return;
    }
    if (existing.status === "OPEN") {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { ...data, occurrences: { increment: 1 } } });
      return;
    }
    // Ignorado continua ignorado (só atualiza o texto); resolvido volta a abrir como ocorrência nova.
    if (existing.status === "IGNORED") {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { ...data, occurrences: { increment: 1 } } });
      return;
    }
    await prisma.systemAlert.update({
      where: { id: existing.id },
      data: { ...data, status: "OPEN", occurrences: 1, firstSeenAt: now, resolvedAt: null, autoResolved: false },
    });
  } catch (error) {
    console.error("system_alert_raise_failed", input.key, error);
  }
}

export async function resolveSystemAlert(agencyId: string, key: string): Promise<void> {
  try {
    await prisma.systemAlert.updateMany({
      where: { agencyId, key, status: { in: ["OPEN", "IGNORED"] } },
      data: { status: "RESOLVED", resolvedAt: new Date(), autoResolved: true },
    });
  } catch (error) {
    console.error("system_alert_resolve_failed", key, error);
  }
}

/** Fecha todos os alertas abertos com um prefixo de chave que não estão em `stillFailing`. */
export async function resolveSystemAlertsByPrefix(agencyId: string, prefix: string, stillFailing: string[]): Promise<void> {
  try {
    await prisma.systemAlert.updateMany({
      where: { agencyId, key: { startsWith: prefix, notIn: stillFailing }, status: { in: ["OPEN", "IGNORED"] } },
      data: { status: "RESOLVED", resolvedAt: new Date(), autoResolved: true },
    });
  } catch (error) {
    console.error("system_alert_resolve_prefix_failed", prefix, error);
  }
}

export const SYSTEM_ALERT_CATEGORY_LABEL: Record<SystemAlertCategory, string> = {
  SITE: "Site",
  TRACKING: "Traqueamento",
  BLOG: "Blog",
  SOCIAL: "Redes sociais",
  AUTOMATION: "Automações",
  INTEGRATION: "Integrações",
};

const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;

/** Resumo para o sino do cabeçalho: alertas abertos (não ignorados), críticos primeiro. */
export async function getSystemAlertSummary(agencyId: string) {
  try {
    const disabled = await getDisabledAlertTypes(agencyId);
    const open = (await prisma.systemAlert.findMany({ where: { agencyId, status: "OPEN" }, orderBy: { lastSeenAt: "desc" }, take: 80 })).filter((a) => {
      const type = alertTypeOfKey(a.key);
      return !type || !disabled.has(type);
    });
    open.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
    return {
      count: open.length,
      critical: open.filter((a) => a.severity === "CRITICAL").length,
      items: open.slice(0, 12).map((a) => ({
        id: a.id,
        title: a.title,
        detail: a.detail,
        href: a.href && a.href.startsWith("/") ? a.href : "/alertas",
        category: a.category,
        severity: a.severity,
        lastSeenAt: a.lastSeenAt.toISOString(),
        occurrences: a.occurrences,
      })),
    };
  } catch {
    return { count: 0, critical: 0, items: [] };
  }
}
