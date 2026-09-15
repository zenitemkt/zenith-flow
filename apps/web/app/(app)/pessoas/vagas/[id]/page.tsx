import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_BADGE_CLASS,
  JOB_STATUS_TRANSITIONS,
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_BADGE_CLASS,
} from "@/lib/hr-jobs";
import { prisma } from "@zenith/db";
import { JobStageBoard } from "./JobStageBoard";
import { NewCandidateModal } from "./NewCandidateModal";
import { JobStatusActions } from "./JobStatusActions";
import { AnonymizeCandidateButton } from "./AnonymizeCandidateButton";

interface PageProps {
  params: { id: string };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      position: true,
      stages: { orderBy: { order: "asc" } },
    },
  });

  if (!job || job.agencyId !== membership.agencyId) {
    notFound();
  }

  const [activeCandidates, decidedCandidates] = await Promise.all([
    prisma.candidate.findMany({ where: { jobId: job.id, status: "EM_ANDAMENTO" } }),
    prisma.candidate.findMany({
      where: { jobId: job.id, status: { in: ["CONTRATADO", "REJEITADO", "DESISTIU"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{job.title}</h1>
          <p className="text-sm text-[#667085]">
            {job.position ? `${job.position.title} · ` : ""}
            {activeCandidates.length} candidato{activeCandidates.length === 1 ? "" : "s"} em andamento (seção 20 do
            manual).
          </p>
          {job.description && <p className="mt-2 max-w-2xl text-sm text-[#475467]">{job.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STATUS_BADGE_CLASS[job.status]}`}>
            {JOB_STATUS_LABELS[job.status]}
          </span>
          <JobStatusActions jobId={job.id} options={JOB_STATUS_TRANSITIONS[job.status]} />
          <NewCandidateModal jobId={job.id} />
        </div>
      </div>

      {job.stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum estágio configurado.</p>
        </div>
      ) : (
        <JobStageBoard stages={job.stages} candidates={activeCandidates} />
      )}

      {decidedCandidates.length > 0 && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Decididos recentemente</h2>
          <div className="flex flex-col gap-2">
            {decidedCandidates.map((candidate) => (
              <div key={candidate.id} className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[#101828]">
                    {candidate.name}
                    {candidate.convertedEmployeeId && (
                      <>
                        {" — "}
                        <Link
                          href={`/pessoas/equipe/${candidate.convertedEmployeeId}`}
                          className="text-[#FF2B00] hover:underline"
                        >
                          ver na equipe
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-[#98A2B3]">
                    {candidate.status === "REJEITADO" && candidate.rejectedReason ? candidate.rejectedReason : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CANDIDATE_STATUS_BADGE_CLASS[candidate.status]}`}
                  >
                    {CANDIDATE_STATUS_LABELS[candidate.status]}
                  </span>
                  {!candidate.anonymizedAt ? (
                    <AnonymizeCandidateButton candidateId={candidate.id} />
                  ) : (
                    <span className="text-xs text-[#98A2B3]">Dados anonimizados</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
