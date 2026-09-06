import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { REQUEST_STATUS_LABELS, REQUEST_PRIORITY_LABELS, REQUEST_STATUS_TRANSITIONS } from "@/lib/requests";
import { prisma } from "@zenith/db";
import { loadCommentThreadView, getMentionableMembers } from "@/lib/comments";
import { CommentThreadPanel } from "@/app/_components/CommentThreadPanel";
import { RequestStatusActions } from "./RequestStatusActions";
import { ConvertToTaskButton } from "./ConvertToTaskButton";

interface PageProps {
  params: { id: string };
}

export default async function RequestDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const req = await prisma.request.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      convertedTask: { select: { id: true, projectId: true } },
    },
  });

  if (!req || req.agencyId !== membership.agencyId) {
    notFound();
  }

  const [thread, mentionableMembers] = await Promise.all([
    loadCommentThreadView("request", req.id),
    getMentionableMembers(membership.agencyId),
  ]);

  const projects = await prisma.project.findMany({
    where: { agencyId: membership.agencyId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{req.title}</h1>
          <p className="text-sm text-[#667085]">
            {req.client ? (
              <Link href={`/clientes/${req.client.id}`} className="text-[#6847F5] hover:underline">
                {req.client.name}
              </Link>
            ) : (
              "Demanda interna"
            )}
            {req.requesterName ? ` · Solicitado por ${req.requesterName}` : ""}
          </p>
          {req.description && <p className="mt-2 max-w-2xl text-sm text-[#475467]">{req.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#475467]">
            {REQUEST_STATUS_LABELS[req.status]}
            {req.priority ? ` · ${REQUEST_PRIORITY_LABELS[req.priority]}` : ""}
          </span>
          <RequestStatusActions requestId={req.id} options={REQUEST_STATUS_TRANSITIONS[req.status]} />
          {req.status === "APROVADA" && (
            <ConvertToTaskButton requestId={req.id} requestTitle={req.title} projects={projects} />
          )}
        </div>
      </div>

      {req.status === "REJEITADA" && req.rejectionReason && (
        <div className="rounded-lg bg-[#FEE4E2] px-4 py-3 text-sm text-[#B42318]">
          <strong>Motivo da rejeição:</strong> {req.rejectionReason}
        </div>
      )}

      {req.convertedTask && (
        <div className="rounded-lg bg-[#EEF2FF] px-4 py-3 text-sm text-[#3730A3]">
          Convertida em tarefa —{" "}
          <Link href={`/operacao/projetos/${req.convertedTask.projectId}`} className="font-medium hover:underline">
            ver no projeto
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommentThreadPanel
          entityType="request"
          entityId={req.id}
          thread={thread}
          mentionableMembers={mentionableMembers}
          currentUserId={session.user.id}
          projects={projects}
        />

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Histórico</h2>
          <div className="flex flex-col gap-3">
            {req.statusHistory.map((entry) => (
              <div key={entry.id} className="border-l-2 border-[#EEF0F3] pl-3">
                <p className="text-sm text-[#101828]">
                  {entry.fromStatus
                    ? `Status mudou de ${REQUEST_STATUS_LABELS[entry.fromStatus]} para ${REQUEST_STATUS_LABELS[entry.toStatus]}${entry.reason ? ` — ${entry.reason}` : ""}`
                    : `Demanda criada como ${REQUEST_STATUS_LABELS[entry.toStatus]}`}
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
