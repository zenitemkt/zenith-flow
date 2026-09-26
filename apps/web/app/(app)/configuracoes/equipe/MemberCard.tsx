"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import type { MembershipRole } from "@zenite-mkt/db";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import type { MemberRow } from "./MembersTable";
import { MEMBER_STATUS_LABELS } from "./MembersTable";

const ROLE_OPTIONS: { value: MembershipRole; label: string }[] = [
  { value: "AGENCY_ADMIN", label: "Admin da Agência" },
  { value: "MANAGER", label: "Gestor" },
  { value: "ANALYST", label: "Analista" },
  { value: "FINANCE", label: "Financeiro" },
  { value: "HR", label: "RH" },
];

type ActionStatus = "idle" | "loading" | "error";

export function MemberCard({
  member,
  canManage,
  onClose,
}: {
  member: MemberRow;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const guardSubmit = useSubmitGuard();

  const [role, setRole] = useState<MembershipRole>(member.role);
  const [roleStatus, setRoleStatus] = useState<ActionStatus>("idle");
  const [roleError, setRoleError] = useState<string | null>(null);

  const [actionStatus, setActionStatus] = useState<ActionStatus>("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [emailStatus, setEmailStatus] = useState<ActionStatus | "done">("idle");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<ActionStatus | "done">("idle");
  const [waMessage, setWaMessage] = useState<string | null>(null);

  const canEditThis = canManage && !member.isSelf;
  const roleChanged = role !== member.role;

  async function saveRole() {
    await guardSubmit(async () => {
      setRoleStatus("loading");
      setRoleError(null);
      const response = await fetch(`/api/memberships/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await response.json().catch(() => null);
      setRoleStatus("idle");
      if (!response.ok) {
        setRoleError(body?.error ?? "Não foi possível salvar o papel.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function setStatus(nextStatus: "ACTIVE" | "SUSPENDED") {
    await guardSubmit(async () => {
      setActionStatus("loading");
      setActionError(null);
      const response = await fetch(`/api/memberships/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json().catch(() => null);
      setActionStatus("idle");
      if (!response.ok) {
        setActionError(body?.error ?? "Não foi possível mudar o status.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function remove() {
    const isPendingInvite = member.status === "INVITED" || member.status === "EXPIRED";
    const confirmed = window.confirm(
      isPendingInvite
        ? "Cancelar este convite? Não será possível desfazer."
        : "Excluir este cadastro? A pessoa perde o acesso ao sistema e isso não pode ser desfeito.",
    );
    if (!confirmed) return;
    await guardSubmit(async () => {
      setActionStatus("loading");
      setActionError(null);
      const response = await fetch(`/api/memberships/${member.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      setActionStatus("idle");
      if (!response.ok) {
        setActionError(body?.error ?? "Não foi possível excluir o cadastro.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function resendEmail() {
    setEmailStatus("loading");
    setEmailMessage(null);
    const response = await fetch(`/api/memberships/${member.id}/send-invite-email`, { method: "POST" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setEmailStatus("error");
      setEmailMessage(body?.error ?? "Não foi possível enviar o e-mail.");
      return;
    }
    setEmailStatus("done");
    setEmailMessage("Enviado ✓");
  }

  async function resendWhatsapp() {
    setWaStatus("loading");
    setWaMessage(null);
    const response = await fetch(`/api/memberships/${member.id}/send-invite-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setWaStatus("error");
      setWaMessage(body?.error ?? "Não foi possível gerar o link do WhatsApp.");
      return;
    }
    window.open(body.waLink, "_blank");
    setWaStatus("done");
    setWaMessage("Aberto ✓");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={member.name ?? member.email}
      description={`${member.email} · ${MEMBER_STATUS_LABELS[member.status]}${member.isSelf ? " · você" : ""}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="member-role" className="text-sm font-medium text-[#344054]">
            Papel (controla o que a pessoa vê no sistema)
          </label>
          <select
            id="member-role"
            value={role}
            disabled={!canEditThis}
            onChange={(e) => setRole(e.target.value as MembershipRole)}
            className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE] disabled:bg-[#F9FAFB] disabled:text-[#98A2B3]"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {canEditThis && roleChanged && (
            <button
              type="button"
              disabled={roleStatus === "loading"}
              onClick={() => void saveRole()}
              className="mt-1 flex h-9 w-fit items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              {roleStatus === "loading" ? "Salvando..." : "Salvar papel"}
            </button>
          )}
          {roleError && <p className="text-xs font-medium text-[#D94343]">{roleError}</p>}
        </div>

        {(member.status === "INVITED" || member.status === "EXPIRED") && canEditThis && (
          <div className="flex flex-col gap-2 rounded-lg bg-[#FFF1EC] p-3">
            <p className="text-xs font-medium text-[#344054]">Reenviar convite</p>
            <FormField
              label="WhatsApp (opcional, só pra gerar o link agora)"
              name="member-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 91234-5678"
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={emailStatus === "loading"}
                  onClick={() => void resendEmail()}
                  className="flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#FF2B00" }}
                >
                  {emailStatus === "loading" ? "Enviando..." : "Enviar e-mail"}
                </button>
                {emailMessage && (
                  <span className={`text-xs font-medium ${emailStatus === "error" ? "text-[#D94343]" : "text-[#166534]"}`}>
                    {emailMessage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={waStatus === "loading" || !phone.trim()}
                  onClick={() => void resendWhatsapp()}
                  className="flex h-9 items-center justify-center rounded-lg border border-[#16A36A] px-3 text-xs font-semibold text-[#16A36A] hover:bg-[#DCFCE7] disabled:opacity-60"
                >
                  {waStatus === "loading" ? "Gerando link..." : "Abrir WhatsApp"}
                </button>
                {waMessage && (
                  <span className={`text-xs font-medium ${waStatus === "error" ? "text-[#D94343]" : "text-[#166534]"}`}>
                    {waMessage}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-[#98A2B3]">Pode mandar pelos dois canais, um de cada vez.</p>
          </div>
        )}

        {canEditThis && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0F3] pt-4">
            <div className="flex flex-wrap gap-2">
              {member.status === "ACTIVE" && (
                <button
                  type="button"
                  disabled={actionStatus === "loading"}
                  onClick={() => void setStatus("SUSPENDED")}
                  className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
                >
                  Inativar acesso
                </button>
              )}
              {member.status === "SUSPENDED" && (
                <button
                  type="button"
                  disabled={actionStatus === "loading"}
                  onClick={() => void setStatus("ACTIVE")}
                  className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
                >
                  Reativar acesso
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={actionStatus === "loading"}
              onClick={() => void remove()}
              className="flex h-9 items-center justify-center rounded-lg border border-[#FEE4E2] px-3 text-sm font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60"
            >
              {member.status === "INVITED" || member.status === "EXPIRED" ? "Cancelar convite" : "Excluir cadastro"}
            </button>
          </div>
        )}
        {actionError && <p className="text-xs font-medium text-[#D94343]">{actionError}</p>}

        {member.isSelf && (
          <p className="text-xs text-[#98A2B3]">
            Este é o seu próprio acesso — mudanças de papel, inativação e exclusão só podem ser feitas por outro admin.
          </p>
        )}
        {!canManage && !member.isSelf && (
          <p className="text-xs text-[#98A2B3]">Seu papel não tem permissão para gerenciar membros.</p>
        )}
      </div>
    </Modal>
  );
}
