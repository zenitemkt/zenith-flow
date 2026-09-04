import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import {
  CONTENT_STATUS_LABELS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_STATUS_TRANSITIONS,
  SUBMITTABLE_STATUSES,
} from "@/lib/content";
import { prisma } from "@zenith/db";
import { ContentStatusActions } from "./ContentStatusActions";
import { NewVersionModal } from "./NewVersionModal";
import { SubmitForApprovalButton } from "./SubmitForApprovalButton";
import { AddContentCommentForm } from "./AddContentCommentForm";

interface PageProps {
  params: { id: string };
}

export default async function ContentDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { approval: true },
      },
      comments: { orderBy: { createdAt: "asc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item || item.agencyId !== membership.agencyId) {
    notFound();
  }

  const canSubmit = SUBMITTABLE_STATUSES.includes(item.status) && item.versions.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{item.title}</h1>
          <p className="text-sm text-[#667085]">
            <Link href={`/clientes/${item.client.id}`} className="text-[#6847F5] hover:underline">
              {item.client.name}
            </Link>
            {` · ${CONTENT_CHANNEL_LABELS[item.channel]}`}
            {item.format ? ` · ${item.format}` : ""}
            {item.scheduledDate ? ` · ${item.scheduledDate.toLocaleDateString("pt-BR")}` : ""}
          </p>
          {item.caption && <p className="mt-2 max-w-2xl text-sm text-[#475467]">{item.caption}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#475467]">
            {CONTENT_STATUS_LABELS[item.status]}
          </span>
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
                      className="text-sm font-medium text-[#6847F5] hover:underline"
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
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Comentários internos</h2>
            <div className="mb-4 flex flex-col gap-2">
              {item.comments.length === 0 && (
                <p className="text-sm text-[#98A2B3]">Nenhum comentário ainda.</p>
              )}
              {item.comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                  <p className="text-sm text-[#101828]">{comment.body}</p>
                  <p className="text-xs text-[#98A2B3]">{comment.createdAt.toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
            <AddContentCommentForm contentId={item.id} />
          </section>
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
