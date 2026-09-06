import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { getAgencyMembers } from "@/lib/team";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/employees";
import { prisma } from "@zenith/db";
import { NewEmployeeModal } from "./NewEmployeeModal";
import { PositionsPanel } from "./PositionsPanel";

const STATUS_BADGE_CLASS: Record<string, string> = {
  ATIVO: "bg-[#DCFCE7] text-[#166534]",
  AFASTADO: "bg-[#FEF3C7] text-[#92600A]",
  DESLIGADO: "bg-[#F2F4F7] text-[#98A2B3]",
};

export default async function EquipePage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const now = new Date();
  const [employees, agencyMembers, positions] = await Promise.all([
    prisma.employee.findMany({
      where: { agencyId: membership.agencyId },
      include: {
        position: true,
        leaveRequests: {
          where: { status: "APROVADA", startDate: { lte: now }, endDate: { gte: now } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getAgencyMembers(membership.agencyId),
    prisma.position.findMany({ where: { agencyId: membership.agencyId }, orderBy: { title: "asc" } }),
  ]);

  const employeeUserIds = new Set(employees.map((e) => e.userId).filter(Boolean));
  const memberOptions = agencyMembers.filter((m) => !employeeUserIds.has(m.userId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Equipe</h1>
          <p className="text-sm text-[#667085]">
            {employees.length} pessoa{employees.length === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pessoas/ferias"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Férias e ausências
          </Link>
          <NewEmployeeModal memberOptions={memberOptions} positions={positions} />
        </div>
      </div>

      <PositionsPanel positions={positions} />

      {employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma pessoa cadastrada ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Pessoa</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const onLeave = employee.leaveRequests.length > 0;
                return (
                  <tr key={employee.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/pessoas/equipe/${employee.id}`}
                        className="font-medium text-[#101828] hover:text-[#6847F5]"
                      >
                        {employee.name}
                      </Link>
                      {employee.email && <p className="text-xs text-[#98A2B3]">{employee.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#475467]">{employee.position?.title ?? employee.role ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[employee.status]}`}
                      >
                        {EMPLOYEE_STATUS_LABELS[employee.status]}
                      </span>
                      {onLeave && (
                        <span className="ml-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92600A]">
                          Fora hoje
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
