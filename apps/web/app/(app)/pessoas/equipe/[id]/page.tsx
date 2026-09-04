import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TRANSITIONS,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_TRANSITIONS,
} from "@/lib/employees";
import { prisma } from "@zenith/db";
import { EmployeeStatusActions } from "./EmployeeStatusActions";
import { NewLeaveRequestModal } from "./NewLeaveRequestModal";
import { LeaveStatusActions } from "./LeaveStatusActions";

interface PageProps {
  params: { id: string };
}

const LEAVE_STATUS_BADGE_CLASS: Record<string, string> = {
  SOLICITADA: "bg-[#F2F4F7] text-[#475467]",
  APROVADA: "bg-[#DCFCE7] text-[#166534]",
  REJEITADA: "bg-[#FEE4E2] text-[#B42318]",
  REALIZADA: "bg-[#F2F4F7] text-[#98A2B3]",
};

export default async function EmployeeProfilePage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      leaveRequests: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!employee || employee.agencyId !== membership.agencyId) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{employee.name}</h1>
          <p className="text-sm text-[#667085]">
            {employee.role ?? "Sem cargo definido"}
            {employee.email ? ` · ${employee.email}` : ""}
          </p>
          {employee.hiredAt && (
            <p className="mt-1 text-sm text-[#98A2B3]">
              Na equipe desde {employee.hiredAt.toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <EmployeeStatusActions
          employeeId={employee.id}
          options={EMPLOYEE_STATUS_TRANSITIONS[employee.status]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#101828]">Férias e ausências</h2>
            <NewLeaveRequestModal employeeId={employee.id} />
          </div>
          <div className="flex flex-col gap-2">
            {employee.leaveRequests.length === 0 && (
              <p className="text-sm text-[#98A2B3]">Nenhuma solicitação ainda.</p>
            )}
            {employee.leaveRequests.map((leave) => (
              <div key={leave.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#101828]">
                      {LEAVE_TYPE_LABELS[leave.type]} · {leave.startDate.toLocaleDateString("pt-BR")} a{" "}
                      {leave.endDate.toLocaleDateString("pt-BR")}
                    </p>
                    {leave.reason && <p className="text-xs text-[#667085]">{leave.reason}</p>}
                    {leave.status === "REJEITADA" && leave.rejectionReason && (
                      <p className="mt-1 text-xs text-[#B42318]">Motivo: {leave.rejectionReason}</p>
                    )}
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${LEAVE_STATUS_BADGE_CLASS[leave.status]}`}
                  >
                    {LEAVE_STATUS_LABELS[leave.status]}
                  </span>
                </div>
                <div className="mt-2">
                  <LeaveStatusActions leaveId={leave.id} options={LEAVE_STATUS_TRANSITIONS[leave.status]} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Histórico</h2>
          <div className="flex flex-col gap-3">
            {employee.statusHistory.length === 0 && (
              <p className="text-sm text-[#98A2B3]">Sem eventos ainda.</p>
            )}
            {employee.statusHistory.map((entry) => (
              <div key={entry.id} className="border-l-2 border-[#EEF0F3] pl-3">
                <p className="text-sm text-[#101828]">
                  {entry.fromStatus
                    ? `Status mudou de ${EMPLOYEE_STATUS_LABELS[entry.fromStatus]} para ${EMPLOYEE_STATUS_LABELS[entry.toStatus]}${entry.reason ? ` — ${entry.reason}` : ""}`
                    : `Pessoa cadastrada como ${EMPLOYEE_STATUS_LABELS[entry.toStatus]}`}
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
