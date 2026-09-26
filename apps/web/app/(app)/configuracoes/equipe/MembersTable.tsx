"use client";

import { useState } from "react";
import type { MembershipRole, MembershipStatus } from "@zenite-mkt/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { MemberCard } from "./MemberCard";

export interface MemberRow {
  id: string;
  name: string | null;
  email: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: string;
  isSelf: boolean;
}

export const MEMBER_STATUS_LABELS: Record<MembershipStatus, string> = {
  INVITED: "Convite pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Inativo",
  EXPIRED: "Convite expirado",
};

const STATUS_BADGE_CLASS: Record<MembershipStatus, string> = {
  ACTIVE: "bg-[#DCFCE7] text-[#166534]",
  INVITED: "bg-[#FEF3C7] text-[#92600A]",
  SUSPENDED: "bg-[#F2F4F7] text-[#98A2B3]",
  EXPIRED: "bg-[#FEE4E2] text-[#B42318]",
};

export function MembersTable({ members, canManage }: { members: MemberRow[]; canManage: boolean }) {
  const [selected, setSelected] = useState<MemberRow | null>(null);

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
        <p className="text-sm text-[#667085]">Nenhum membro cadastrado ainda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                onClick={() => setSelected(member)}
                className="cursor-pointer border-t border-[#EEF0F3] hover:bg-[#F9FAFB]"
              >
                <td className="px-4 py-3 font-medium text-[#101828]">
                  {member.name ?? "—"}
                  {member.isSelf && <span className="ml-1 text-xs font-normal text-[#98A2B3]">(você)</span>}
                </td>
                <td className="px-4 py-3 text-[#475467]">{member.email}</td>
                <td className="px-4 py-3 text-[#475467]">{ROLE_LABELS[member.role]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[member.status]}`}
                  >
                    {MEMBER_STATUS_LABELS[member.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <MemberCard member={selected} canManage={canManage} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
