import { prisma } from "@zenite-mkt/db";
import { raiseSystemAlert } from "@/lib/system-alerts";
import { mergeProspectingConfig } from "./config";
import { sendDueProspectEmails } from "./outreach";
import { checkProspectSearch, startProspectSearch } from "./search";

const INTERVAL_MS = { daily: 20 * 3_600_000, weekly: 6.5 * 86_400_000 } as const;

/**
 * Rotina da manhã (Vercel Cron às 7h e 7h40): importa buscas que terminaram no Apify, inicia a busca
 * automática quando vence (diária ou semanal, se ligada) e envia os e-mails do dia. A segunda rodada
 * importa o resultado das buscas iniciadas na primeira. O WhatsApp fica de fora: é manual.
 */
export async function runDailyProspecting(now = new Date()): Promise<Record<string, unknown>[]> {
  const all = await prisma.prospectingSettings.findMany({ select: { agencyId: true, config: true, apifyTokenEnc: true, pendingRuns: true, lastSearchAt: true } });
  const report: Record<string, unknown>[] = [];
  for (const settings of all) {
    const config = mergeProspectingConfig(settings.config);
    const entry: Record<string, unknown> = { agencyId: settings.agencyId };
    let pending = Array.isArray(settings.pendingRuns) ? settings.pendingRuns.length : 0;
    if (pending) {
      const result = await checkProspectSearch(settings.agencyId).catch((e) => ({ error: String(e) }));
      entry.imported = result;
      pending = "pending" in result ? result.pending : pending;
    }

    const interval = config.autoSearch === "off" ? null : INTERVAL_MS[config.autoSearch];
    const due = interval !== null && !pending && settings.apifyTokenEnc && config.segments.length && config.cities.length && (!settings.lastSearchAt || now.getTime() - settings.lastSearchAt.getTime() >= interval);
    if (due) {
      entry.search = await startProspectSearch(settings.agencyId).catch(async (e) => {
        const detail = e instanceof Error ? e.message : String(e);
        await raiseSystemAlert({ agencyId: settings.agencyId, key: "prospecting:auto-search", category: "AUTOMATION", severity: "WARNING", title: "Prospecção automática: a busca do dia não começou", detail, href: "/prospeccao?aba=busca" });
        return { error: detail };
      });
    }

    if (config.email.enabled) {
      entry.emails = await sendDueProspectEmails(settings.agencyId, now).catch(async (e) => {
        const detail = e instanceof Error ? e.message : String(e);
        await raiseSystemAlert({ agencyId: settings.agencyId, key: "prospecting:emails", category: "AUTOMATION", severity: "WARNING", title: "Prospecção automática: e-mails do dia não saíram", detail, href: "/prospeccao?aba=contato" });
        return { error: detail };
      });
    }
    report.push(entry);
  }
  return report;
}
