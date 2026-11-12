import { prisma } from "@zenite-mkt/db";
import type { SystemAlertCategory, SystemAlertSeverity } from "@prisma/client";

/**
 * Central de alertas de sistema. `raiseSystemAlert` abre (ou soma uma ocorrência em) um alerta
 * pela chave; `resolveSystemAlert` fecha quando a checagem volta a passar. As duas nunca lançam
 * erro: um alerta que falhou ao gravar não pode derrubar a rotina que detectou o problema.
 */
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
    const open = await prisma.systemAlert.findMany({ where: { agencyId, status: "OPEN" }, orderBy: { lastSeenAt: "desc" }, take: 50 });
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
