import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { getAgencyMembers } from "@/lib/team";
import {
  CONTENT_STATUS_LABELS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_STATUS_TRANSITIONS,
  SUBMITTABLE_STATUSES,
} from "@/lib/content";
import { prisma } from "@zenith/db";
import { loadCommentThreadView, getMentionableMembers } from "@/lib/comments";
import { CommentThreadPanel } from "@/app/_components/CommentThreadPanel";
import { ContentStatusActions } from "./ContentStatusActions";
import { NewVersionModal } from "./NewVersionModal";
import { SubmitForApprovalButton } from "./SubmitForApprovalButton";
import { EditVersionLinkButton } from "./EditVersionLinkButton";
import { EditContentDetailsButton } from "./EditContentDetailsButton";
import { ChecklistPanel } from "./ChecklistPanel";

export async function ContentDetailView({ id }: { id: string }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
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
  const [thread, mentionableMembers, agencyMembers] = await Promise.all([
    loadCommentThreadView("content_item", item.id),
    getMentionableMembers(membership.agencyId),
    getAgencyMembers(membership.agencyId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{item.title}</h1>
          <p className="text-sm text-[#667085]">
            <Link href={`/clientes/${item.client.id}`} className="text-[#FF2B00] hover:underline">
              {item.client.name}
            </Link>
            {` · ${CONTENT_CHANNEL_LABELS[item.channel]}`}
            {item.format ? ` · ${item.format}` : ""}
            {item.scheduledDate ? ` · ${item.scheduledDate.toLocaleDateString("pt-BR")}` : ""}
          </p>
          {item.description && (
            <div className="mt-2 max-w-2xl rounded-lg bg-[#F9FAFB] p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Descrição</p>
              <p className="whitespace-pre-wrap text-sm text-[#475467]">{item.description}</p>
            </div>
          )}
          {item.caption && <p className="mt-2 max-w-2xl text-sm text-[#475467]">{item.caption}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#475467]">
            {CONTENT_STATUS_LABELS[item.status]}
          </span>
          <EditContentDetailsButton
            contentId={item.id}
            initialTitle={item.title}
            initialDescription={item.description ?? ""}
          />
          <ContentStatusActions contentId={item.id} options={CONTENT_STATUS_TRANSITIONS[item.status]} />
          {canSubmit && <SubmitForApprovalButton contentId={item.id} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#101828]">Versões</h2>
              <NewVersionModal contentId={item.id} />
            </div>
            <div className="flex flex-col gap-2">
              {item.versions.length === 0 && (
                <p className="text-sm text-[#98A2B3]">Nenhuma versão ainda.</p>
              )}
              {item.versions.map((version) => (
                <div key={version.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <a
                      href={version.assetUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-[#FF2B00] hover:underline"
                    >
                      Versão {version.versionNumber}
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
                  {version.notes && <p className="mt-0.5 text-xs text-[#98A2B3]">{version.notes}</p>}
                  {version.approval?.decisionNote && (
                    <p className="mt-1 text-xs text-[#B42318]">
                      Feedback do cliente: {version.approval.decisionNote}
                    </p>
                  )}
                  {(!version.approval || version.approval.status === "PENDENTE") && (
                    <div className="mt-1.5">
                      <EditVersionLinkButton
                        contentId={item.id}
                        versionId={version.id}
                        currentUrl={version.assetUrl}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <ChecklistPanel contentId={item.id} items={item.checklistItems} />

          <CommentThreadPanel
            entityType="content_item"
            entityId={item.id}
            thread={thread}
            mentionableMembers={mentionableMembers}
            currentUserId={session.user.id}
            assignableMembers={agencyMembers}
          />
        </div>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Histórico</h2>
          <div className="flex flex-col gap-3">
            {item.statusHistory.map((entry) => (
              <div key={entry.id} className="border-l-2 border-[#EEF0F3] pl-3">
                <p className="text-sm text-[#101828]">
                  {entry.fromStatus
                    ? `Status mudou de ${CONTENT_STATUS_LABELS[entry.fromStatus]} para ${CONTENT_STATUS_LABELS[entry.toStatus]}${entry.reason ? ` — ${entry.reason}` : ""}`
                    : `Peça criada como ${CONTENT_STATUS_LABELS[entry.toStatus]}`}
                </p>
                <p className="text-xs text-[#98A2B3]">{entry.createdAt.toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
