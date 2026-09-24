import Link from "next/link";
import { requirePortalContext } from "@/lib/portal";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { prisma } from "@zenite-mkt/db";
import {
  CONTENT_PHASE_DOT,
  CONTENT_PHASE_LABELS,
  contentPhase,
  ghostButtonClass,
  panelClass,
  primaryButtonClass,
} from "./_components/ui";

function greetingFor(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(now),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

export default async function PortalHomePage() {
  const { client } = await requirePortalContext();

  const [pendingApprovals, upcoming, openRequests] = await Promise.all([
    prisma.contentApproval.findMany({
      where: { status: "PENDENTE", contentVersion: { contentItem: { clientId: client.id } } },
      include: { contentVersion: { include: { contentItem: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.contentItem.findMany({
      where: {
        clientId: client.id,
        scheduledDate: { gte: new Date() },
        status: { notIn: ["ARQUIVADO"] },
      },
      orderBy: { scheduledDate: "asc" },
      take: 5,
    }),
    prisma.task.count({
      where: { project: { clientId: client.id }, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
    }),
  ]);

  const pending = pendingApprovals.length;
  const headline =
    pending > 0
      ? `${pending} ${plural(pending, "peça espera", "peças esperam")} a sua aprovação.`
      : "Nada esperando por você agora. Está tudo em dia.";

  const supporting = [
    upcoming.length > 0
      ? `${upcoming.length} ${plural(upcoming.length, "publicação agendada", "publicações agendadas")} nos próximos dias`
      : null,
    openRequests > 0
      ? `${openRequests} ${plural(openRequests, "solicitação", "solicitações")} em andamento com a equipe`
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-12">
      <section className="max-w-3xl">
        <p className="text-[15px] text-[#A3A5B2]">{greetingFor(new Date())},</p>
        <h1 className="mt-1 font-display text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-[#F5F2EE]">
          {client.name}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#E7E4E0]">{headline}</p>
        {supporting.length > 0 && (
          <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-[#8B8D9A]">{supporting.join(", e ")}.</p>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          {pending > 0 ? (
            <Link href="/portal/aprovacoes" className={primaryButtonClass}>
              Revisar {plural(pending, "a peça", "as peças")}
            </Link>
          ) : (
            <Link href="/portal/calendario" className={primaryButtonClass}>
              Ver calendário
            </Link>
          )}
          <Link href="/portal/solicitacoes" className={ghostButtonClass}>
            Pedir algo à equipe
          </Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section className={`${panelClass} p-6`}>
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Esperando sua aprovação</h2>
            {pending > 0 && (
              <Link href="/portal/aprovacoes" className="text-sm font-medium text-[#FF8A5C] hover:text-[#FFB08F]">
                Ver todas
              </Link>
            )}
          </div>
          {pending === 0 ? (
            <p className="text-sm leading-relaxed text-[#8B8D9A]">
              Quando a equipe enviar uma peça pra você aprovar, ela aparece aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingApprovals.slice(0, 4).map((approval) => {
                const item = approval.contentVersion.contentItem;
                return (
                  <li key={approval.id}>
                    <Link
                      href="/portal/aprovacoes"
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5 transition-colors hover:border-[#FF2B00]/40 hover:bg-[#FF2B00]/[0.05]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium text-[#F5F2EE]">{item.title}</span>
                        <span className="mt-0.5 flex gap-2 text-xs text-[#8B8D9A]">
                          <span>{CONTENT_CHANNEL_LABELS[item.channel]}</span>
                          <span>versão {approval.contentVersion.versionNumber}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-[#A3A5B2]">
                        responder até
                        <span className="block text-sm font-medium text-[#F5F2EE]">
                          {approval.expiresAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${panelClass} p-6`}>
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Próximas publicações</h2>
            <Link href="/portal/calendario" className="text-sm font-medium text-[#FF8A5C] hover:text-[#FFB08F]">
              Calendário
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm leading-relaxed text-[#8B8D9A]">
              Nenhuma publicação com data marcada ainda. Assim que a equipe agendar, a agenda aparece aqui.
            </p>
          ) : (
            <ol className="relative flex flex-col gap-5 before:absolute before:bottom-2 before:left-[27px] before:top-2 before:w-px before:bg-white/[0.08]">
              {upcoming.map((item, index) => {
                const date = item.scheduledDate!;
                const phase = contentPhase(item.status);
                return (
                  <li key={item.id} className="relative flex items-center gap-4">
                    <span
                      className={`relative z-10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border ${
                        index === 0
                          ? "border-[#FF2B00]/50 bg-[#1D1210] shadow-[0_0_24px_-6px_rgba(255,43,0,0.6)]"
                          : "border-white/[0.07] bg-[#0E0F15]"
                      }`}
                    >
                      <span className="font-display text-xl font-semibold leading-none">
                        {date.toLocaleDateString("pt-BR", { day: "numeric", timeZone: "UTC" })}
                      </span>
                      <span className="mt-0.5 text-[11px] text-[#8B8D9A]">
                        {date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "")}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{item.title}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-[#8B8D9A]">
                        <span>{CONTENT_CHANNEL_LABELS[item.channel]}</span>
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${CONTENT_PHASE_DOT[phase]}`} />
                          {CONTENT_PHASE_LABELS[phase]}
                        </span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section className="flex flex-col items-start justify-between gap-4 rounded-[22px] border border-dashed border-white/10 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-base font-semibold">Precisa de material impresso?</p>
          <p className="mt-0.5 text-sm text-[#8B8D9A]">
            Cartão de visitas, panfleto, banner, lona, adesivo. A equipe faz o orçamento pra você.
          </p>
        </div>
        <Link href="/portal/grafica" className={ghostButtonClass}>
          Pedir cotação
        </Link>
      </section>
    </div>
  );
}
