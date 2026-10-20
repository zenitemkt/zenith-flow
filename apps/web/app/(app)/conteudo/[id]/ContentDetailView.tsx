import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { getAgencyMembers } from "@/lib/team";
import {
  CONTENT_BOARD_COLUMNS,
  CONTENT_STATUS_BADGE_CLASS,
  CONTENT_STATUS_LABELS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_STATUS_TRANSITIONS,
  SUBMITTABLE_STATUSES,
  contentBoardColumnForStatus,
} from "@/lib/content";
import { clientInitials } from "@/lib/clients";
import { prisma } from "@zenite-mkt/db";
import { loadCommentThreadView, getMentionableMembers } from "@/lib/comments";
import { CommentThreadPanel } from "@/app/_components/CommentThreadPanel";
import { ContentStatusActions } from "./ContentStatusActions";
import { NewVersionModal } from "./NewVersionModal";
import { SubmitForApprovalButton } from "./SubmitForApprovalButton";
import { EditVersionLinkButton } from "./EditVersionLinkButton";
import { EditContentDetailsButton } from "./EditContentDetailsButton";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { ChecklistPanel } from "./ChecklistPanel";
import { ContentPropertiesPanel } from "./ContentPropertiesPanel";

/** Rótulos curtos da trilha de etapas — mesmos 5 baldes do quadro de Operação. */
const STEP_LABEL: Record<string, string> = {
  a_fazer: "A fazer",
  fazendo: "Fazendo",
  aguardando_aprovacao: "Aprovação",
  agendar: "Agendar",
  concluido: "Concluído",
};

/** Dica do que falta quando não há ação principal de status (pedido do usuário, 2026-10-20: tela confusa). */
function nextStepHint(status: string, hasVersion: boolean): string | null {
  if ((status === "REVISAO_INTERNA" || status === "AJUSTES") && !hasVersion) {
    return "Adicione uma versão (link da arte) para poder enviar ao cliente.";
  }
  if (status === "AGUARDANDO_CLIENTE") return "Aguardando o cliente aprovar ou pedir ajustes pelo link enviado.";
  return null;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs font-medium text-[#667085]">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-[#101828]">{children}</span>
    </div>
  );
}

export async function ContentDetailView({ id, showBack = true }: { id: string; showBack?: boolean }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          avatarKey: true,
          contacts: { select: { email: true, phone: true, isPrimary: true }, orderBy: { isPrimary: "desc" } },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { approval: true },
      },
      statusHistory: { orderBy: { createdAt: "desc" } },
      checklistItems: { orderBy: { order: "asc" } },
    },
  });

  if (!item || item.agencyId !== membership.agencyId) {
    notFound();
  }

  const canSubmit = SUBMITTABLE_STATUSES.includes(item.status) && item.versions.length > 0;
  const primaryContact = item.client.contacts.find((c) => c.isPrimary) ?? item.client.contacts.find((c) => c.email);
  const [thread, mentionableMembers, agencyMembers] = await Promise.all([
    loadCommentThreadView("content_item", item.id),
    getMentionableMembers(membership.agencyId),
    getAgencyMembers(membership.agencyId),
  ]);

  const currentStep = CONTENT_BOARD_COLUMNS.findIndex((c) => c.id === contentBoardColumnForStatus(item.status));
  const isArchived = item.status === "ARQUIVADO";
  const hint = nextStepHint(item.status, item.versions.length > 0);
  const checklistDone = item.checklistItems.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-5">
      {showBack && (
        <Link
          href="/operacao"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#667085] hover:text-[#FF2B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B00] focus-visible:ring-offset-2"
        >
          <ArrowLeft size={15} aria-hidden /> Operação
        </Link>
      )}

      {/* ---------- cabeçalho: de quem é, o quê, e em que etapa está ---------- */}
      <header className="flex flex-col gap-4 pr-10">
        <Link href={`/clientes/${item.client.id}`} className="flex w-fit items-center gap-2 text-sm font-medium text-[#475467] hover:text-[#101828]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#3b3f4a] text-[10px] font-bold text-white">
            {item.client.avatarKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/clients/${item.client.id}/image/avatar`} alt="" className="h-full w-full object-cover" />
            ) : (
              clientInitials(item.client.name)
            )}
          </span>
          {item.client.name}
          <span className="text-[#98A2B3]">·</span>
          <span className="font-normal text-[#667085]">
            {CONTENT_CHANNEL_LABELS[item.channel]}
            {item.format ? ` · ${item.format}` : ""}
          </span>
        </Link>

        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight tracking-[-0.01em] text-[#101828] sm:text-2xl">{item.title}</h1>
          <span className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}>
            {CONTENT_STATUS_LABELS[item.status]}
          </span>
        </div>

        {!isArchived && (
          <ol className="flex items-center gap-1" aria-label="Etapas da peça">
            {CONTENT_BOARD_COLUMNS.map((column, index) => {
              const done = index < currentStep;
              const current = index === currentStep;
              return (
                <li key={column.id} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
                  <span className={`h-1.5 rounded-full ${done ? "bg-[#16A36A]" : current ? "bg-[#FF2B00]" : "bg-[#E4E7EC]"}`} />
                  <span
                    className={`flex items-center gap-1 truncate text-[11px] font-medium ${
                      current ? "text-[#101828]" : done ? "text-[#16A36A]" : "text-[#98A2B3]"
                    }`}
                  >
                    {done && <Check size={11} aria-hidden className="shrink-0" />}
                    {STEP_LABEL[column.id]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* uma ação principal clara; o resto como secundário */}
        <div className="flex flex-wrap items-center gap-2">
          {canSubmit && (
            <SubmitForApprovalButton
              contentId={item.id}
              defaultEmail={primaryContact?.email ?? null}
              defaultWhatsapp={primaryContact?.phone ?? null}
            />
          )}
          <ContentStatusActions contentId={item.id} options={CONTENT_STATUS_TRANSITIONS[item.status]} primary={!canSubmit} />
          <div className="ml-auto">
            <EditContentDetailsButton contentId={item.id} initialTitle={item.title} initialDescription={item.description ?? ""} />
          </div>
          {hint && <p className="basis-full text-xs text-[#667085]">{hint}</p>}
        </div>
      </header>

      {/* ---------- corpo: conteúdo à esquerda, detalhes à direita (no celular: detalhes primeiro) ---------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="flex flex-col gap-4 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-4 lg:col-start-2 lg:row-start-1">
          <h2 className="text-sm font-semibold text-[#101828]">Detalhes</h2>
          <div className="flex flex-col gap-2.5">
            <Property label="Cliente">
              <Link href={`/clientes/${item.client.id}`} className="hover:underline">
                {item.client.name}
              </Link>
            </Property>
            <Property label="Canal">{CONTENT_CHANNEL_LABELS[item.channel]}</Property>
            <Property label="Formato">{item.format ?? <span className="text-[#98A2B3]">—</span>}</Property>
            {item.campaign && <Property label="Campanha">{item.campaign}</Property>}
          </div>
          <ContentPropertiesPanel
            contentId={item.id}
            scheduledDateISO={item.scheduledDate ? item.scheduledDate.toISOString() : null}
            assigneeUserIds={item.assigneeUserIds}
            people={agencyMembers}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Section title="Descrição">
            {item.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#344054]">{item.description}</p>
            ) : (
              <p className="text-sm text-[#98A2B3]">Sem descrição. Use &quot;Editar&quot; para explicar o que precisa ser feito.</p>
            )}
            {item.caption && (
              <div className="mt-4 border-t border-[#EEF0F3] pt-3">
                <p className="mb-1 text-xs font-medium text-[#667085]">Legenda</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#344054]">{item.caption}</p>
              </div>
            )}
          </Section>

          <Section title={`Versões${item.versions.length ? ` · ${item.versions.length}` : ""}`} action={<NewVersionModal contentId={item.id} />}>
            <div className="flex flex-col gap-2">
              {item.versions.length === 0 && (
                <p className="text-sm text-[#98A2B3]">Nenhuma versão ainda. Adicione o link da arte quando estiver pronta.</p>
              )}
              {item.versions.map((version) => (
                <div key={version.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={version.assetUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#101828] hover:text-[#FF2B00]"
                    >
                      Versão {version.versionNumber}
                      <ExternalLink size={13} aria-hidden className="text-[#98A2B3]" />
                    </a>
                    {version.approval && (
                      <span
                        className={
                          version.approval.status === "APROVADO"
                            ? "rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]"
                            : version.approval.status === "AJUSTES_SOLICITADOS"
                              ? "rounded-full bg-[#FEE4E2] px-2 py-0.5 text-xs font-medium text-[#B42318]"
                              : "rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92600A]"
                        }
                      >
                        {version.approval.status === "APROVADO"
                          ? "Aprovada"
                          : version.approval.status === "AJUSTES_SOLICITADOS"
                            ? "Ajustes pedidos"
                            : "Aguardando cliente"}
                      </span>
                    )}
                  </div>
                  {version.notes && <p className="mt-1 text-xs text-[#667085]">{version.notes}</p>}
                  {version.approval?.decisionNote && (
                    <p className="mt-1.5 rounded-md bg-[#FEF3F2] px-2 py-1.5 text-xs text-[#B42318]">
                      Feedback do cliente: {version.approval.decisionNote}
                    </p>
                  )}
                  {(!version.approval || version.approval.status === "PENDENTE") && (
                    <div className="mt-1.5">
                      <EditVersionLinkButton contentId={item.id} versionId={version.id} currentUrl={version.assetUrl} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <div className="flex flex-col gap-2">
            {item.checklistItems.length > 0 && (
              <div className="flex items-center gap-2 px-1" aria-label={`Checklist: ${checklistDone} de ${item.checklistItems.length}`}>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E4E7EC]">
                  <span
                    className="block h-full rounded-full bg-[#16A36A]"
                    style={{ width: `${Math.round((checklistDone / item.checklistItems.length) * 100)}%` }}
                  />
                </span>
                <span className="text-xs font-medium text-[#667085]">
                  {checklistDone}/{item.checklistItems.length}
                </span>
              </div>
            )}
            <ChecklistPanel contentId={item.id} items={item.checklistItems} />
          </div>

          <CommentThreadPanel
            entityType="content_item"
            entityId={item.id}
            thread={thread}
            mentionableMembers={mentionableMembers}
            currentUserId={session.user.id}
            assignableMembers={agencyMembers}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
          <Section title="Histórico">
            <ol className="flex flex-col gap-3">
              {item.statusHistory.map((entry) => (
                <li key={entry.id} className="relative border-l-2 border-[#EEF0F3] pl-3">
                  <p className="text-xs text-[#344054]">
                    {entry.fromStatus ? (
                      <>
                        {CONTENT_STATUS_LABELS[entry.fromStatus]} → <strong className="font-semibold">{CONTENT_STATUS_LABELS[entry.toStatus]}</strong>
                        {entry.reason ? ` — ${entry.reason}` : ""}
                      </>
                    ) : (
                      <>
                        Criada como <strong className="font-semibold">{CONTENT_STATUS_LABELS[entry.toStatus]}</strong>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#98A2B3]">
                    {entry.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
          {canManageTeam(membership.role) && (
            <div className="flex justify-center lg:justify-start">
              <DeleteRecordButton
                endpoint={`/api/content/${item.id}`}
                recordName={item.title}
                entityLabel="Conteúdo"
                warning="Versões, aprovações, checklist, comentários e histórico vinculados também serão removidos."
                redirectTo="/operacao"
                variant="button"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
