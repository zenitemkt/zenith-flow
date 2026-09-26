import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { JOB_STATUS_LABELS, JOB_STATUS_BADGE_CLASS } from "@/lib/hr-jobs";
import { prisma } from "@zenite-mkt/db";
import { NewJobModal } from "./NewJobModal";

export default async function JobsPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [jobs, positions] = await Promise.all([
    prisma.job.findMany({
      where: { agencyId: membership.agencyId },
      include: { position: true, candidates: { where: { status: "EM_ANDAMENTO" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.position.findMany({ where: { agencyId: membership.agencyId }, orderBy: { title: "asc" } }),
  ]);

  const canDelete = canManageTeam(membership.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Vagas</h1>
          <p className="text-sm text-[#667085]">{jobs.length} vaga{jobs.length === 1 ? "" : "s"} (seção 20 do manual).</p>
        </div>
        <NewJobModal positions={positions} />
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma vaga aberta ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#EEF0F3] bg-white px-4 py-3 hover:border-[#FF2B00]">
              <div className="min-w-0 flex-1">
                <Link href={`/pessoas/vagas/${job.id}`} className="text-sm font-medium text-[#101828] hover:text-[#FF2B00]">
                  {job.title}
                </Link>
                <p className="text-xs text-[#98A2B3]">
                  {job.position ? `${job.position.title} · ` : ""}
                  {job.candidates.length} candidato{job.candidates.length === 1 ? "" : "s"} em andamento
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${JOB_STATUS_BADGE_CLASS[job.status]}`}>
                {JOB_STATUS_LABELS[job.status]}
              </span>
              {canDelete && <DeleteRecordButton endpoint={`/api/jobs/${job.id}`} recordName={job.title} entityLabel="Vaga" warning="Etapas, candidatos e todo o histórico deste processo seletivo também serão removidos." />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
