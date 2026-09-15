"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/app/_components/FormField";

interface PortalMember {
  id: string;
  email: string;
  role: "CLIENT_ADMIN" | "CLIENT_VIEWER";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
}

const ROLE_LABELS: Record<PortalMember["role"], string> = {
  CLIENT_ADMIN: "Admin",
  CLIENT_VIEWER: "Visualizador",
};

const STATUS_LABELS: Record<PortalMember["status"], string> = {
  INVITED: "Convite pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  EXPIRED: "Expirado",
};

export function ClientPortalSection({
  clientId,
  clientIsActive,
  members,
}: {
  clientId: string;
  clientIsActive: boolean;
  members: PortalMember[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PortalMember["role"]>("CLIENT_VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInviteUrl(null);
    setLoading(true);

    const response = await fetch(`/api/clients/${clientId}/portal-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await response.json().catch(() => null);

    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível enviar o convite.");
      return;
    }

    setInviteUrl(new URL(body.inviteUrl, window.location.origin).toString());
    setEmail("");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#101828]">Portal do cliente</h2>

      {!clientIsActive ? (
        <p className="text-sm text-[#98A2B3]">
          O cliente precisa estar <strong>Ativo</strong> (com workspace criado) para ter acesso ao
          portal.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2">
            {members.length === 0 && (
              <p className="text-sm text-[#98A2B3]">Ninguém convidado pro portal ainda.</p>
            )}
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[#101828]">{member.email}</p>
                  <p className="text-xs text-[#667085]">{ROLE_LABELS[member.role]}</p>
                </div>
                <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#475467]">
                  {STATUS_LABELS[member.status]}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <FormField
                label="E-mail"
                type="email"
                name="portal-invite-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@cliente.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="portal-invite-role" className="text-sm font-medium text-[#344054]">
                Papel
              </label>
              <select
                id="portal-invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as PortalMember["role"])}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
              >
                <option value="CLIENT_VIEWER">Visualizador</option>
                <option value="CLIENT_ADMIN">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              {loading ? "Enviando..." : "Convidar"}
            </button>
          </form>

          {error && <p className="mt-3 text-sm font-medium text-[#D94343]">{error}</p>}

          {inviteUrl && (
            <div className="mt-3 rounded-lg bg-[#FFF1EC] p-3 text-sm text-[#C2270A]">
              <p className="mb-1 font-medium">
                Convite criado. Envie este link pro cliente (envio automático de e-mail chega na Fase
                2):
              </p>
              <code className="block break-all text-xs">{inviteUrl}</code>
            </div>
          )}
        </>
      )}
    </section>
  );
}
