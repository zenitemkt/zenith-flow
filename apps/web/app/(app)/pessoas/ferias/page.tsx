import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LEAVE_STATUS_TRANSITIONS } from "@/lib/employees";
import { prisma } from "@zenite-mkt/db";
import { LeaveStatusActions } from "../equipe/[id]/LeaveStatusActions";

const LEAVE_STATUS_BADGE_CLASS: Record<string, string> = {
  SOLICITADA: "bg-[#F2F4F7] text-[#475467]",
  APROVADA: "bg-[#DCFCE7] text-[#166534]",
  REJEITADA: "bg-[#FEE4E2] text-[#B42318]",
  REALIZADA: "bg-[#F2F4F7] text-[#98A2B3]",
};

export default async function FeriasPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [pending, decided] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { agencyId: membership.agencyId, status: "SOLICITADA" },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { agencyId: membership.agencyId, status: { not: "SOLICITADA" } },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Férias e ausências</h1>
          <p className="text-sm text-[#667085]">
            {pending.length} solicitação{pending.length === 1 ? "" : "ões"} aguardando decisão.
          </p>
        </div>
        <Link
          href="/pessoas/equipe"
          className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
        >
          Ver equipe
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">Aguardando decisão ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center">
            <p className="text-sm text-[#667085]">Nada pendente agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((leave) => (
              <div key={leave.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/pessoas/equipe/${leave.employee.id}`}
                      className="text-sm font-semibold text-[#101828] hover:text-[#FF2B00]"
                    >
                      {leave.employee.name}
                    </Link>
                    <p className="text-xs text-[#98A2B3]">
                      {LEAVE_TYPE_LABELS[leave.type]} · {leave.startDate.toLocaleDateString("pt-BR")} a{" "}
                      {leave.endDate.toLocaleDateString("pt-BR")}
                    </p>
                    {leave.reason && <p className="mt-1 text-sm text-[#475467]">{leave.reason}</p>}
                  </div>
                  <LeaveStatusActions leaveId={leave.id} options={LEAVE_STATUS_TRANSITIONS[leave.status]} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">Decididas recentemente</h2>
        {decided.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nenhuma decisão registrada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3">Pessoa</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((leave) => (
                  <tr key={leave.id} className="border-t border-[#EEF0F3]">
                    <td className="px-4 py-3 font-medium text-[#101828]">{leave.employee.name}</td>
                    <td className="px-4 py-3 text-[#475467]">{LEAVE_TYPE_LABELS[leave.type]}</td>
                    <td className="px-4 py-3 text-[#475467]">
                      {leave.startDate.toLocaleDateString("pt-BR")} a {leave.endDate.toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEAVE_STATUS_BADGE_CLASS[leave.status]}`}
                      >
                        {LEAVE_STATUS_LABELS[leave.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
